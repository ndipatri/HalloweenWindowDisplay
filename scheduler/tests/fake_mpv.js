// A fake mpv for the tests: an in-memory playlist that behaves like mpv's
// for the commands the box uses. Not a test file itself.
'use strict';
const { EventEmitter } = require('events');

class FakeMpv {
  constructor() {
    this.entries = []; // { id, filename }
    this.pos = -1; // index of the playing entry; -1 when idle
    this.nextId = 1;
    this.events = [];
    this.commands = [];
    this.props = {}; // properties set with set_property
    this.overlays = {}; // id -> the overlay-add arguments after the id
    this.osd = { width: 1920, height: 1080 }; // the panel, as mpv's OSD has it
  }

  async command(...args) {
    this.commands.push(args);
    const [name, ...rest] = args;
    if (name === 'loadfile') {
      const [filename, mode, index, options] = rest;
      if (mode !== 'append-play') throw new Error('fake mpv only supports append-play');
      if (index !== undefined && index !== -1) throw new Error('fake mpv only appends at the end');
      this.entries.push({ id: this.nextId++, filename, options: options || '' });
      if (this.pos === -1) this.pos = this.entries.length - 1;
    } else if (name === 'playlist-remove') {
      const i = rest[0];
      if (i < 0 || i >= this.entries.length) throw new Error('error running command');
      this.entries.splice(i, 1);
      if (this.pos > i) this.pos--;
      // Like mpv: removing the playing entry plays the next one, if any.
      else if (this.pos === i && i >= this.entries.length) this.pos = -1;
    } else if (name === 'set_property') {
      this.props[rest[0]] = rest[1];
    } else if (name === 'overlay-add') {
      this.overlays[rest[0]] = rest.slice(1);
    } else if (name === 'overlay-remove') {
      delete this.overlays[rest[0]];
    } else if (name === 'stop') {
      this.entries = [];
      this.pos = -1;
    } else {
      throw new Error('fake mpv does not know ' + name);
    }
    return null;
  }

  async getProperty(name) {
    if (name === 'osd-width') return this.osd.width;
    if (name === 'osd-height') return this.osd.height;
    if (name !== 'playlist') throw new Error('fake mpv does not know property ' + name);
    return this.entries.map((e, i) => Object.assign({}, e, i === this.pos ? { current: true, playing: true } : {}));
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---- Test controls ----

  // The paths in mpv's playlist, in order.
  files() { return this.entries.map((e) => e.filename); }

  // The playing path, or null when idle.
  playing() { return this.pos === -1 ? null : this.entries[this.pos].filename; }

  // The playing video ends normally; mpv moves on (idle after the last one).
  finish() { this.advance('eof'); }

  // mpv can't play the current video: it reports an error and moves on.
  fail() { this.advance('error'); }

  advance(reason) {
    if (this.pos === -1) throw new Error('nothing is playing');
    const e = this.entries[this.pos];
    this.events.push(Object.assign({ event: 'end-file', reason, playlist_entry_id: e.id },
      reason === 'error' ? { file_error: 'unrecognized file format' } : {}));
    this.pos = this.pos + 1 < this.entries.length ? this.pos + 1 : -1;
  }
}

// A fake child process for mpv: call exit(code) to make it stop.
class FakeChild extends EventEmitter {
  exit(code, signal = null) { this.emit('exit', code, signal); }
}

module.exports = { FakeMpv, FakeChild };
