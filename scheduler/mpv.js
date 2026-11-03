// Starts mpv on the box and talks to it over its JSON IPC socket.
// https://mpv.io/manual/stable/#json-ipc
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');

// mpv straight to the TV (no desktop), black when idle, turned for a TV on
// its side, controlled only through the socket.
function mpvArgs(box) {
  return [
    '--idle=yes',
    '--force-window=yes',
    '--fullscreen',
    '--vo=gpu',
    '--gpu-context=drm',
    // Software decoding: the Pi 5 has no H.264 hardware decoder, and trying the
    // ones that don't apply (Vulkan, CUDA) logs errors on every video. For HEVC
    // videos, which the Pi 5 can decode in hardware, this would be --hwdec=drm.
    '--hwdec=no',
    '--video-rotate=' + box.rotate,
    '--no-audio',
    '--prefetch-playlist=yes',
    '--no-osc',
    '--osd-level=0',
    '--no-input-default-bindings',
    '--input-terminal=no',
    '--cursor-autohide=always',
    '--msg-level=all=warn',
    '--input-ipc-server=' + box.mpvSocket,
  ];
}

function startMpv(box) {
  try { fs.rmSync(box.mpvSocket, { force: true }); } catch (e) { /* not there */ }
  return spawn('mpv', mpvArgs(box), { stdio: ['ignore', 'inherit', 'inherit'] });
}

// Connects to mpv's socket, waiting for mpv to create it.
function connect(socketPath, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection(socketPath);
      socket.once('connect', () => resolve(new MpvClient(socket)));
      socket.once('error', (e) => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error("couldn't connect to mpv: " + e.message));
        else setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

// The same interface as the tests' FakeMpv: command(...args),
// getProperty(name), takeEvents().
class MpvClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) this.receive(line);
      }
    });
    socket.on('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('mpv closed its socket'));
      this.pending.clear();
    });
  }

  receive(line) {
    let message;
    try { message = JSON.parse(line); } catch (e) { return; }
    if (message.event) {
      this.events.push(message);
    } else if (this.pending.has(message.request_id)) {
      const { resolve, reject, args } = this.pending.get(message.request_id);
      this.pending.delete(message.request_id);
      if (message.error === 'success') resolve(message.data === undefined ? null : message.data);
      else reject(new Error('mpv ' + args.join(' ') + ': ' + message.error));
    }
  }

  command(...args) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, args });
      this.socket.write(JSON.stringify({ command: args, request_id: id }) + '\n');
    });
  }

  getProperty(name) {
    return this.command('get_property', name);
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

module.exports = { mpvArgs, startMpv, connect, MpvClient };
