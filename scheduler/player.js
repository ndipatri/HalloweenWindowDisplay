// The box's player: every second, works out what should be on the TV and
// has mpv show it. Also serves the website. Run by systemd (tvbox.service):
//   node /opt/tvbox/player.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createScheduler } = require('./logic.js');

const CLOCK_NOT_SET = 'black (waiting for the clock to be set)';

// `options`: { config, videoRoot, mpv, now() -> Date, clockIsSet() -> bool,
//              readText, writeText, removeFile, listFolder, log }
function createPlayer(options) {
  const { mpv, now, clockIsSet, writeText, log } = options;
  const logic = createScheduler(options);

  const playlists = {};
  const overrideState = { warnedText: null };
  let activeName; // undefined until the first tick, then a key or null
  let active = null;
  let status = null;
  let idle = false; // mpv stopped with nothing queued

  async function blank() {
    if (!idle) await mpv.command('stop');
    idle = true;
  }

  // mpv's playlist is changed by the tick and by dropFile; one at a time, so
  // neither reads it while the other is changing it.
  let busy = Promise.resolve();
  function serially(fn) {
    const done = busy.then(fn);
    busy = done.catch(() => {});
    return done;
  }

  async function tickNow() {
    const choice = clockIsSet()
      ? logic.whatToShow(logic.readFilters(), now(), overrideState)
      : { filter: null, status: CLOCK_NOT_SET };

    if (choice.status !== status) {
      status = choice.status;
      log('Now showing: ' + status);
      writeText(logic.STATUS_PATH, status + '\n');
    }

    const name = choice.filter;
    if (name !== activeName) {
      if (active) logic.setAside(active);
      idle = false;
      await blank();
      activeName = name;
      if (name) {
        if (!playlists[name]) playlists[name] = logic.createPlaylist(name);
        active = playlists[name];
      } else {
        active = null;
      }
    }

    if (active) {
      const hasVideo = await logic.keepPlaying(active, mpv);
      idle = !hasVideo;
    } else {
      mpv.takeEvents(); // nothing to report while black
    }
  }

  // An upload is about to be deleted: take it out of mpv's playlist first,
  // so mpv moves on cleanly instead of failing on a missing file.
  async function dropFileNow(file) {
    const entries = (await mpv.getProperty('playlist')) || [];
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].filename === file) await mpv.command('playlist-remove', i);
    }
  }

  // Tags or filters were saved on the website (or an upload removed). While
  // a filter plays, the queue behind the item on screen is rebuilt from its
  // items as they are now; an item on screen that no longer belongs gives
  // way to the next one after it, queued first so mpv moves straight on to
  // it rather than going black.
  let refilterWaiting = null;
  async function refilterNow() {
    if (!active) return;
    // What it plays is gone (a filter renamed or deleted): the next tick sorts it out.
    if (!logic.playlistItems(active).known) return;
    const entries = (await mpv.getProperty('playlist')) || [];
    const current = entries.findIndex((e) => e.current);
    if (current === -1) {
      idle = !(await logic.keepPlaying(active, mpv));
      return;
    }
    // mpv may move on meanwhile, so each removal reads the playlist afresh
    // and never takes out the entry that is on screen by then.
    let onScreen = entries[current].filename;
    for (;;) {
      const now = (await mpv.getProperty('playlist')) || [];
      const at = now.findIndex((e) => e.current);
      if (at === -1) return; // mpv went idle meanwhile: the next tick starts afresh
      onScreen = now[at].filename; // what is on screen by now
      if (at >= now.length - 1) break;
      await mpv.command('playlist-remove', now.length - 1);
    }
    const item = { name: onScreen.split('/').pop(), path: onScreen };
    const items = logic.playlistItems(active).items;
    if (items.some((v) => v.path === onScreen)) {
      active.lastQueued = item;
      idle = !(await logic.keepPlaying(active, mpv));
      return;
    }
    // The next item after it in name order (or the first).
    active.resumeAt = items.find((v) => logic.compareVideos(v, item) > 0) || null;
    active.lastQueued = null;
    await logic.keepPlaying(active, mpv); // queues behind the item on screen
    const now = (await mpv.getProperty('playlist')) || [];
    const at = now.findIndex((e) => e.current && e.filename === onScreen);
    if (at !== -1) await mpv.command('playlist-remove', at);
    idle = !(await logic.keepPlaying(active, mpv));
  }

  return {
    tick: () => serially(tickNow),
    dropFile: (file) => serially(() => dropFileNow(file)),
    // Several saves in a row (tagging one item after another) need one
    // rebuild, not one each: a rebuild still waiting to start covers them all.
    refilter: () => {
      if (refilterWaiting) return refilterWaiting;
      refilterWaiting = serially(() => { refilterWaiting = null; return refilterNow(); });
      return refilterWaiting;
    },
    logic,
  };
}

// When mpv exits, the box exits too, so systemd starts both again fresh.
function watchMpv(child, { log, exit }) {
  child.on('exit', (code, signal) => {
    const how = code !== null && code !== undefined ? 'exit code ' + code : 'signal ' + signal;
    log('ERROR: mpv stopped (' + how + '). Exiting so the box restarts.');
    exit(1);
  });
}

// ---------- On the box ----------

function realIo() {
  return {
    readText(p) {
      try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
    },
    writeText(p, text) {
      const tmp = p + '.tmp.' + process.pid;
      fs.writeFileSync(tmp, text);
      fs.renameSync(tmp, p);
    },
    removeFile(p) {
      fs.rmSync(p, { force: true });
    },
    listFolder(p) {
      try { return fs.readdirSync(p); } catch (e) { return null; }
    },
    // A file's size in bytes, or null.
    fileSize(p) {
      try { return fs.statSync(p).size; } catch (e) { return null; }
    },
    // The last `bytes` of a file (all of it if smaller), or null.
    readTail(p, bytes) {
      let fd;
      try {
        fd = fs.openSync(p, 'r');
        const size = fs.fstatSync(fd).size;
        const length = Math.min(size, bytes);
        const buffer = Buffer.alloc(length);
        fs.readSync(fd, buffer, 0, length, size - length);
        return buffer.toString('utf8');
      } catch (e) {
        return null;
      } finally {
        if (fd !== undefined) fs.closeSync(fd);
      }
    },
    log(message) {
      // systemd appends this to ~/video-scheduler/scheduler.log.
      console.log(new Date().toLocaleString('en-US') + '  ' + message);
    },
  };
}

async function main() {
  const config = require('./config.js');
  const { startMpv, connect } = require('./mpv.js');
  const { startWebsite } = require('./website.js');
  const box = config.box;
  const io = realIo();
  const videoRoot = box.videoRoot || path.join(os.homedir(), 'video-scheduler');
  fs.mkdirSync(videoRoot, { recursive: true });

  const child = startMpv(box, config);
  watchMpv(child, { log: io.log, exit: (code) => process.exit(code) });
  const mpv = await connect(box.mpvSocket);

  const player = createPlayer(Object.assign({}, io, {
    config,
    videoRoot,
    mpv,
    now: () => new Date(),
    clockIsSet: () => fs.existsSync(box.clockFile),
  }));
  io.log('Started. Videos: ' + videoRoot);
  const filters = player.logic.readFilters();
  if (filters.length) io.log('Filters: ' + filters.map((f) => f.name).join(', '));

  startWebsite(Object.assign({}, io, {
    config,
    videoRoot,
    now: () => new Date(),
    beforeRemove: player.dropFile,
    filtersChanged: player.refilter,
  }), box.webPort);

  for (;;) {
    try {
      await player.tick();
    } catch (e) {
      io.log('ERROR: ' + e.message);
    }
    await new Promise((r) => setTimeout(r, config.checkSeconds * 1000));
  }
}

module.exports = { createPlayer, watchMpv, realIo };

if (require.main === module) {
  main().catch((e) => {
    console.log(new Date().toLocaleString('en-US') + '  ERROR: ' + (e.stack || e));
    process.exit(1);
  });
}
