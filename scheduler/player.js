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
  const { config, mpv, now, clockIsSet, writeText, log } = options;
  const logic = createScheduler(options);
  const schedule = logic.validSchedule(config.schedule);
  const seasons = logic.validSeasons(config.seasons);

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

  async function tick() {
    const choice = clockIsSet()
      ? logic.whatToShow(schedule, seasons, now(), overrideState)
      : { playlist: null, status: CLOCK_NOT_SET };

    if (choice.status !== status) {
      status = choice.status;
      log('Now showing: ' + status);
      writeText(logic.STATUS_PATH, status + '\n');
    }

    const name = choice.playlist;
    if (name !== activeName) {
      if (active) logic.setAside(active);
      idle = false;
      await blank();
      activeName = name;
      if (name) {
        if (!playlists[name]) playlists[name] = logic.createPlaylist(name, seasons);
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

  return { tick, logic, schedule, seasons };
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

  const child = startMpv(box);
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
  io.log(
    player.seasons.length
      ? 'Seasons: ' + player.seasons.map(player.logic.describeSeason).join('; ')
      : 'No seasons: playlists play all year.',
  );

  startWebsite(Object.assign({}, io, { config, videoRoot, now: () => new Date() }), box.webPort);

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
