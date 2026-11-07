// The box's website: shows what's on the TV and changes it for a while, as
// `show` did on the Mac. Served by the player at http://<box name>.local/.
// It only writes ~/video-scheduler/override.json; the player reads that file
// every second, so a change shows within a second or two.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const { Transform, pipeline: pipeStreams } = require('stream');
const { pipeline } = require('stream/promises');
const { createScheduler } = require('./logic.js');

// Plain names: 'kid', 'christmas', 'christmas/kid'. No hidden names, no
// paths out of the video folder, no quotes or backslashes.
const PLAYLIST_NAME = /^[^/.\\"][^/\\"]*(\/[^/.\\"][^/\\"]*)?$/;

// How much of the log to show, and how much of its end to read for that.
const LOG_LINES = 20;
const LOG_TAIL_BYTES = 16 * 1024;

// Uploads: what each kind of file is sent as.
const CONTENT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
};
const MB = 1024 * 1024;
const GB = 1024 * MB;
const COUNTS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

// `options`: { config, videoRoot, now() -> Date, log, readText, writeText,
//              removeFile, listFolder, fileSize(path) -> bytes or null,
//              readTail(path, bytes) -> text or null,
//              startSync() -> false if a sync it started is still running,
//              freeBytes() -> bytes free on the SD card,
//              beforeRemove(path) -> promise, run before an upload is deleted }
// Uploads are written with Node's fs directly, as they are streamed to disk.
function createWebsite(options) {
  const { config, videoRoot, now, readText, writeText, removeFile, listFolder, readTail, startSync } = options;
  const log = options.log || (() => {});
  const logic = createScheduler(Object.assign({ log() {} }, options));
  const isFolder = (p) => listFolder(p) !== null;
  const visible = (name) => !name.startsWith('.');
  const PHOTOS_DIR = videoRoot + '/' + logic.PHOTOS;
  const PIN_PATH = videoRoot + '/upload-pin';
  const COUNTER_PATH = PHOTOS_DIR + '/.last-number';
  const limits = config.uploads;
  const pinLock = { wrong: 0, until: 0 };

  // Part files left by an upload cut off when the box stopped: no upload can
  // be under way yet, so every one is left over.
  try {
    for (const n of fs.readdirSync(PHOTOS_DIR)) {
      if (n.startsWith('.upload-')) fs.rmSync(PHOTOS_DIR + '/' + n, { force: true });
    }
  } catch (e) { /* no photos folder yet */ }

  function choices() {
    const playlists = [];
    for (const period of config.schedule) {
      if (period && typeof period.playlist === 'string' && !playlists.includes(period.playlist)) {
        playlists.push(period.playlist);
      }
    }
    const previews = [];
    const tops = (listFolder(videoRoot) || []).filter(visible).sort(logic.compareNames);
    for (const top of tops) {
      if (top === logic.PHOTOS || top === logic.PICKS) continue; // offered as All uploads and My picks instead
      if (!isFolder(videoRoot + '/' + top)) continue;
      previews.push(top);
      const subs = (listFolder(videoRoot + '/' + top) || []).filter(visible).sort(logic.compareNames);
      for (const sub of subs) {
        if (isFolder(videoRoot + '/' + top + '/' + sub)) previews.push(top + '/' + sub);
      }
    }
    return { playlists, previews, photos: true, picks: true };
  }

  // ---------- My picks ----------

  function writePicks(picks) {
    writeText(logic.PICKS_PATH, JSON.stringify({ picks }, null, 2) + '\n');
  }

  // Lets the player rebuild its queue if the picks are playing. The picks
  // are saved by then, so a problem here is logged, not the request's.
  async function picksChanged() {
    if (!options.picksChanged) return;
    try {
      await options.picksChanged();
    } catch (e) {
      log("ERROR: Couldn't change what is queued for My picks: " + e.message);
    }
  }

  function listPicks() {
    return { items: logic.pickableItems(), picks: logic.readPicks().filter(logic.pickable) };
  }

  async function savePicks(body) {
    if (!body || !Array.isArray(body.picks)) return fail('Bad request.');
    const picks = [];
    for (const rel of body.picks) {
      if (!logic.pickable(rel)) return fail("Can't pick " + (typeof rel === 'string' ? rel : JSON.stringify(rel)) + '.');
      if (!picks.includes(rel)) picks.push(rel);
    }
    writePicks(picks);
    log('My picks: ' + picks.length + ' picked (from the website).');
    await picksChanged();
    return json(200, { message: picks.length ? 'Saved. ' + picks.length + ' picked.' : 'Saved. Nothing picked.', picks });
  }

  // A new upload joins the end of the picks; a removed one leaves them.
  async function addPick(rel) {
    const picks = logic.readPicks();
    if (picks.includes(rel)) return;
    writePicks(picks.concat([rel]));
    await picksChanged();
  }
  async function dropPick(rel) {
    const picks = logic.readPicks();
    if (!picks.includes(rel)) return;
    writePicks(picks.filter((p) => p !== rel));
    await picksChanged();
  }

  // ---------- Uploads ----------

  // The saved upload PIN, or null if there is none (or it isn't 4 to 8 digits).
  function savedPin() {
    const text = readText(PIN_PATH);
    const pin = text === null ? '' : text.trim();
    return /^\d{4,8}$/.test(pin) ? pin : null;
  }

  function samePin(given, saved) {
    const a = Buffer.from(typeof given === 'string' ? given : '');
    const b = Buffer.from(saved);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // null if `pin` lets the request through, otherwise the refusal. Wrong or
  // missing PINs in a row lock uploads, checks and removals for a while.
  function checkPin(pin) {
    const saved = savedPin();
    if (saved === null) return json(403, { error: 'Adding photos is off: no upload PIN is set on the box.' });
    const at = now();
    if (at.getTime() < pinLock.until) {
      return json(429, { error: 'Too many wrong PINs. Try again after ' + logic.formatTime(new Date(pinLock.until), at) + '.' });
    }
    if (!samePin(pin, saved)) {
      pinLock.wrong++;
      if (pinLock.wrong >= limits.pinTries) {
        pinLock.wrong = 0;
        pinLock.until = at.getTime() + limits.lockMinutes * 60 * 1000;
        log((COUNTS[limits.pinTries] || String(limits.pinTries)) + ' wrong upload PINs in a row: uploads locked until ' +
          logic.formatTime(new Date(pinLock.until), at));
      }
      return json(403, { error: 'Wrong PIN.' });
    }
    pinLock.wrong = 0;
    return null;
  }

  function extensionOf(name) {
    return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  }

  // null if the box can take every one of `files` ({ name, bytes }),
  // otherwise the refusal.
  function checkFiles(files) {
    for (const f of files) {
      if (!logic.isVideoFile(f.name, true)) {
        return json(400, { error: 'Only JPEG or PNG photos and MP4, MOV or M4V videos can be added.' });
      }
      if (f.bytes > limits.maxBytes) {
        return json(413, { error: 'Too big: one file can be at most ' + gbText(limits.maxBytes) + '.' });
      }
    }
    const total = files.reduce((sum, f) => sum + f.bytes, 0);
    if (options.freeBytes() - total < limits.keepFreeBytes) {
      const what = files.length === 1 ? files[0].name : 'these ' + files.length + ' files';
      return json(507, { error: 'Not enough room on the box for ' + what + ': ' + gbText(limits.keepFreeBytes) + ' must stay free.' });
    }
    return null;
  }

  // The uploads, in the order they play.
  function uploadNames() {
    return (listFolder(PHOTOS_DIR) || []).filter((n) => logic.isVideoFile(n, true)).sort(logic.compareNames);
  }

  function listUploads() {
    return {
      pinSet: savedPin() !== null,
      uploads: uploadNames().map((name) => ({
        name,
        kind: config.photoExtensions.includes(extensionOf(name)) ? 'photo' : 'video',
        bytes: options.fileSize(PHOTOS_DIR + '/' + name),
      })),
    };
  }

  // Asked before a batch is sent, so a refusal shows before any file goes.
  function checkBatch(headers, body) {
    const files = body && Array.isArray(body.files) ? body.files : null;
    const valid = files && files.length > 0 && files.every((f) =>
      f && typeof f.name === 'string' && Number.isInteger(f.bytes) && f.bytes >= 0);
    if (!valid) return fail('Bad request.');
    const refused = checkPin(pinFrom(headers)) || checkFiles(files);
    if (refused) return refused;
    return ok('Ready to add ' + files.length + (files.length === 1 ? ' file.' : ' files.'));
  }

  // One file, streamed to a hidden part file and then numbered into place.
  // `stream` is not read at all when the upload is refused.
  async function receiveUpload({ name, pin, length, stream }) {
    if (typeof name !== 'string' || !Number.isInteger(length) || length < 0) return fail('Bad request.');
    const refused = checkPin(pin) || checkFiles([{ name, bytes: length }]);
    if (refused) return refused;

    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    const part = PHOTOS_DIR + '/.upload-' + crypto.randomBytes(6).toString('hex');
    let received = 0;
    const counter = new Transform({
      transform(chunk, encoding, done) {
        received += chunk.length;
        done(received > length ? new Error('more than was said') : null, chunk);
      },
    });
    // The phone going away is expected; the box failing to write is not.
    // Newer Node passes the phone's own error on to the file too, so that
    // one isn't the box failing to write.
    let failure = null;
    let dropped = null;
    stream.on('error', (e) => { dropped = e; });
    const out = fs.createWriteStream(part, { flags: 'wx' });
    out.on('error', (e) => { if (e !== dropped) failure = e; });
    try {
      await pipeline(stream, counter, out);
    } catch (e) {
      received = -1;
    }
    if (received !== length) {
      fs.rmSync(part, { force: true });
      if (failure) log('ERROR: Upload of ' + name + ' failed on the box: ' + failure.message);
      log('Upload of ' + name + ' stopped partway; nothing kept.');
      return fail('The upload of ' + name + ' stopped partway; nothing was kept.');
    }
    const saved = numberIntoPlace(part, name);
    log('Uploaded photos/' + saved + ' (' + (length / MB).toFixed(1) + ' MB)');
    await addPick(logic.PHOTOS + '/' + saved);
    return ok('Added ' + name + '.');
  }

  // Gives the part file the next number. A link never overwrites, so two
  // uploads finishing at once can't take the same number. The last number
  // given is kept in a hidden file, so removing the newest upload never
  // frees its number: phones keep each upload's picture cached by its name.
  function numberIntoPlace(part, original) {
    const base = cleanName(original);
    for (;;) {
      let last = 0;
      try { last = Number(fs.readFileSync(COUNTER_PATH, 'utf8').trim()) || 0; } catch (e) { /* none yet */ }
      const highest = (listFolder(PHOTOS_DIR) || [])
        .map((n) => /^(\d+)-/.exec(n))
        .filter(Boolean)
        .reduce((max, m) => Math.max(max, Number(m[1])), last);
      const number = highest + 1;
      const final = String(number).padStart(5, '0') + '-' + base;
      try {
        fs.linkSync(part, PHOTOS_DIR + '/' + final);
        fs.rmSync(part, { force: true });
        // The upload is saved even if this fails: only log it.
        try {
          fs.writeFileSync(COUNTER_PATH + '.new', number + '\n');
          fs.renameSync(COUNTER_PATH + '.new', COUNTER_PATH);
        } catch (e) {
          log("ERROR: Couldn't save the upload counter: " + e.message);
        }
        return final;
      } catch (e) {
        if (e.code !== 'EEXIST') {
          fs.rmSync(part, { force: true });
          throw e;
        }
      }
    }
  }

  // 'Beach Day!!.MOV' -> 'beach-day.mov'; '写真.jpg' -> 'upload.jpg'.
  function cleanName(original) {
    const extension = extensionOf(original);
    const stem = original.slice(0, original.length - extension.length - 1)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .slice(0, 60)
      .replace(/^-+|-+$/g, '');
    return (stem || 'upload') + '.' + extension;
  }

  async function removeUpload(headers, body) {
    const name = body && typeof body.name === 'string' ? body.name : '';
    const refused = checkPin(pinFrom(headers));
    if (refused) return refused;
    if (!uploadNames().includes(name)) return json(404, { error: 'No upload named ' + name + '.' });
    const file = PHOTOS_DIR + '/' + name;
    if (options.beforeRemove) await options.beforeRemove(file);
    removeFile(file);
    log('Removed photos/' + name + ' (from the website)');
    await dropPick(logic.PHOTOS + '/' + name);
    return ok('Removed ' + name + '.');
  }

  // What to send for GET /photos/<name>: { status, headers, path, start, end }
  // for the server to stream, or an answer with nothing to stream.
  function fileResponse(urlPath, range) {
    let name;
    try {
      name = decodeURIComponent(urlPath.split('?')[0].slice('/photos/'.length));
    } catch (e) {
      name = null;
    }
    if (!name || !uploadNames().includes(name)) return json(404, { error: 'Not found.' });
    const file = PHOTOS_DIR + '/' + name;
    const size = options.fileSize(file);
    if (size === null) return json(404, { error: 'Not found.' });
    const headers = {
      'Content-Type': CONTENT_TYPES[extensionOf(name)] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      // An upload's name never changes and is never reused.
      'Cache-Control': 'max-age=31536000, immutable',
    };
    const m = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (!m || (m[1] === '' && m[2] === '')) {
      return { status: 200, headers: Object.assign(headers, { 'Content-Length': size }), path: file, start: 0, end: size - 1 };
    }
    let start;
    let end;
    if (m[1] === '') {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) {
      return { status: 416, headers: { 'Content-Range': 'bytes */' + size }, body: '' };
    }
    return {
      status: 206,
      headers: Object.assign(headers, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': end - start + 1 }),
      path: file,
      start,
      end,
    };
  }

  function show(body) {
    const target = typeof body.target === 'string' ? body.target.trim() : '';
    const black = target === 'black' || target === 'off';
    if (!black && !PLAYLIST_NAME.test(target)) {
      return fail('Not a playlist name: ' + (target || '(none)') + '. Choose kid, grownup, a season, or a season/playlist.');
    }
    if (!black && target.startsWith(logic.PHOTOS + '/')) {
      return fail('Not a playlist name: ' + target + '. All uploads plays all the uploads together.');
    }
    if (!black && target.startsWith(logic.PICKS + '/')) {
      return fail('Not a playlist name: ' + target + '. My picks plays the picked items.');
    }
    if (target === logic.PICKS && !logic.readPicks().some(logic.pickable)) {
      return fail('Nothing is picked yet. Tick something under My picks first.');
    }
    if (!black && target.includes('/')) {
      const season = target.split('/')[0];
      if (!isFolder(videoRoot + '/' + season)) return fail('No ' + season + ' folder on the box.');
    }

    const until = body.until === undefined ? 'schedule' : body.until;
    const minutes = Number(until);
    if (until !== 'schedule' && until !== 'cleared' && !(Number.isInteger(minutes) && minutes > 0)) {
      return fail('Not a number of minutes: ' + until);
    }

    const at = now();
    const override = {
      playlist: black ? null : target,
      setAt: at.getTime(),
      expires: until === 'schedule' || until === 'cleared' ? null : at.getTime() + minutes * 60 * 1000,
      untilCleared: until === 'cleared',
    };
    const text = JSON.stringify(override) + '\n';
    if (!logic.parseOverride(text).ok) return fail('Not a playlist name: ' + target);
    writeText(logic.OVERRIDE_PATH, text);

    const label = black ? 'black' : target;
    if (until === 'schedule') return ok('Showing ' + label + ' until the schedule next changes.');
    if (until === 'cleared') return ok('Showing ' + label + ' until you choose Back to schedule.');
    return ok('Showing ' + label + ' until ' + logic.formatTime(new Date(override.expires), at) +
      ', then back to the schedule.');
  }

  async function handle({ method, path, headers, body }) {
    const route = method + ' ' + path.split('?')[0];
    if (route === 'GET /') return { status: 200, type: 'text/html', body: PAGE };
    if (route === 'GET /api/status') {
      const text = readText(logic.STATUS_PATH);
      return json(200, { status: text === null ? null : text.trim() });
    }
    if (route === 'GET /api/choices') return json(200, choices());
    if (route === 'GET /api/uploads') return json(200, listUploads());
    if (route === 'GET /api/picks') return json(200, listPicks());
    if (route === 'POST /api/picks') {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return fail('Bad request.'); }
      return savePicks(parsed);
    }
    if (route === 'POST /api/uploads/check' || route === 'POST /api/uploads/remove') {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return fail('Bad request.'); }
      return route === 'POST /api/uploads/check' ? checkBatch(headers, parsed) : removeUpload(headers, parsed);
    }
    if (route === 'GET /api/log') {
      const text = readTail(videoRoot + '/scheduler.log', LOG_TAIL_BYTES);
      const lines = text === null ? [] : text.split('\n').filter((l) => l.trim() !== '');
      // The first line may be cut off where the read started, unless the
      // whole log fit.
      if (text !== null && text.length >= LOG_TAIL_BYTES) lines.shift();
      return json(200, { lines: lines.slice(-LOG_LINES) });
    }
    if (route === 'POST /api/sync') {
      return startSync()
        ? ok('Syncing now. New videos play within a minute or two.')
        : ok('A sync is already running.');
    }
    if (route === 'POST /api/schedule') {
      removeFile(logic.OVERRIDE_PATH);
      return ok('Override cancelled. Following the schedule.');
    }
    if (route === 'POST /api/show') {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return fail('Bad request.'); }
      if (!parsed || typeof parsed !== 'object') return fail('Bad request.');
      return show(parsed);
    }
    return json(404, { error: 'Not found.' });
  }

  return { handle, choices, receiveUpload, fileResponse };
}

function pinFrom(headers) {
  return headers ? headers['x-upload-pin'] : undefined;
}

function gbText(bytes) {
  return Math.round((bytes / GB) * 10) / 10 + ' GB';
}

function json(status, value) {
  return { status, type: 'application/json', body: JSON.stringify(value) };
}
function ok(message) { return json(200, { message }); }
function fail(error) { return json(400, { error }); }

// Serves the website. A failure to listen is logged, not fatal: the TV
// keeps playing without it.
function startWebsite(options, port) {
  const site = createWebsite(Object.assign({
    startSync: syncStarter(options),
    freeBytes: () => {
      const s = fs.statfsSync(options.videoRoot);
      return s.bavail * s.bsize;
    },
  }, options));
  // No overall time limit, so a big upload on slow Wi-Fi isn't cut off.
  const server = http.createServer({ requestTimeout: 0 }, (req, res) => {
    const send = (r) => {
      if (res.headersSent || res.destroyed) return;
      res.writeHead(r.status, { 'Content-Type': r.type + '; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(r.body);
    };
    const failed = (e) => {
      options.log('ERROR: Website: ' + e.message);
      send(json(500, { error: 'Something went wrong on the box.' }));
    };
    const urlPath = req.url.split('?')[0];

    if ((req.method === 'GET' || req.method === 'HEAD') && urlPath.startsWith('/photos/')) {
      const r = site.fileResponse(urlPath, req.headers.range);
      if (r.type) return send(r);
      res.writeHead(r.status, r.headers);
      if (!r.path || r.end < r.start || req.method === 'HEAD') return res.end();
      // pipeline closes the file if the phone stops reading partway.
      pipeStreams(fs.createReadStream(r.path, { start: r.start, end: r.end }), res, () => {});
      return undefined;
    }

    // An upload: the file is the body, streamed to disk, never held in memory.
    if (req.method === 'POST' && urlPath === '/api/uploads') {
      const m = /[?&]name=([^&]*)/.exec(req.url);
      let name = null;
      try { name = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null; } catch (e) { name = null; }
      const length = Number(req.headers['content-length']);
      if (!name || !Number.isInteger(length)) return send(json(400, { error: 'Bad request.' }));
      site.receiveUpload({ name, pin: req.headers['x-upload-pin'], length, stream: req }).then(send, failed);
      return undefined;
    }

    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });
    req.on('end', () => {
      site.handle({ method: req.method, path: req.url, headers: req.headers, body }).then(send, failed);
    });
    return undefined;
  });
  // A connection that sends nothing for two minutes is closed.
  server.timeout = 120000;
  server.on('error', (e) => options.log('ERROR: Website on port ' + port + ': ' + e.message));
  server.listen(port, () => options.log('Website: http://' + require('os').hostname() + '.local' +
    (port === 80 ? '' : ':' + port) + '/'));
  return server;
}

// Starts ~/video-scheduler/sync with its output appended to the log, as the
// hourly timer does. Returns false while a sync it started is still running.
// (The sync's own lock also keeps it from overlapping the timer's.)
function syncStarter(options) {
  const { spawn } = require('child_process');
  let running = false;
  return () => {
    if (running) return false;
    const out = fs.openSync(options.videoRoot + '/scheduler.log', 'a');
    let child;
    try {
      child = spawn(options.videoRoot + '/sync', [], { stdio: ['ignore', out, out] });
    } finally {
      fs.closeSync(out);
    }
    running = true;
    child.on('error', (e) => {
      running = false;
      options.log("ERROR: Couldn't start sync: " + e.message);
    });
    child.on('exit', () => { running = false; });
    return true;
  };
}

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Window</title>
<style>
  :root { color-scheme: dark; --bg: #121212; --card: #1e1e1e; --text: #f2f2f2; --dim: #a0a0a0; --accent: #ff8a1f; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 17px/1.4 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
  main { max-width: 480px; margin: 0 auto; padding: 20px 16px 40px; }
  h1 { font-size: 22px; margin: 0 0 14px; }
  h2 { font-size: 15px; font-weight: 600; color: var(--dim); text-transform: uppercase; letter-spacing: .04em; margin: 22px 0 8px; }
  .card { background: var(--card); border-radius: 12px; padding: 14px 16px; }
  .now { margin-bottom: 12px; }
  #status { font-weight: 600; }
  button.current { border-color: var(--accent); outline: 3px solid var(--accent); outline-offset: 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  button, select { font: inherit; color: var(--text); background: #2c2c2c; border: 1px solid #3a3a3a; border-radius: 10px; padding: 12px; width: 100%; }
  button { cursor: pointer; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #1a1a1a; font-weight: 600; }
  .row { display: flex; gap: 10px; }
  .row > * { flex: 1; }
  #message { min-height: 1.4em; margin-top: 10px; color: var(--accent); }
  #message.error { color: #ff6b6b; }
  #log { font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--dim); white-space: pre-wrap; word-break: break-word; }
  input[type=password] { font: inherit; color: var(--text); background: #2c2c2c; border: 1px solid #3a3a3a; border-radius: 10px; padding: 12px; width: 100%; margin-bottom: 10px; }
  .pick { display: block; position: relative; text-align: center; background: var(--accent); color: #1a1a1a; font-weight: 600; border-radius: 10px; padding: 12px; cursor: pointer; }
  .pick input { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
  #progress { font-size: 14px; color: var(--dim); margin-top: 8px; }
  .uploads { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .upload { background: var(--card); border-radius: 10px; padding: 6px; font-size: 12px; color: var(--dim); overflow: hidden; }
  .upload img, .upload video { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: #000; }
  .upload .name { display: block; margin: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .upload button { padding: 6px; font-size: 13px; }
  .group { font-size: 13px; color: var(--dim); margin: 12px 0 4px; }
  .group:first-child { margin-top: 0; }
  .pickrow { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid #2c2c2c; cursor: pointer; }
  .pickrow input { width: 22px; height: 22px; accent-color: var(--accent); flex: none; }
  .pickrow .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pickrow .num { flex: none; min-width: 26px; text-align: center; font-weight: 600; color: #1a1a1a; background: var(--accent); border-radius: 13px; padding: 1px 6px; font-size: 14px; }
  .pickrow .num:empty { display: none; }
  .hint { font-size: 14px; color: var(--dim); margin-bottom: 10px; }
  .pickbar { position: sticky; bottom: 0; background: var(--card); border-top: 1px solid #3a3a3a; margin-top: 8px; padding: 10px 0 12px; display: flex; gap: 10px; align-items: center; }
  .pickbar #picknote { flex: 1; font-size: 14px; }
  .pickbar #picknote.saved { color: #7bd88f; }
  .pickbar #picknote.error { color: #ff6b6b; }
  button:disabled { opacity: .45; cursor: default; }
  button:active:not(:disabled) { transform: scale(.96); filter: brightness(1.2); }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <h1>Window</h1>

  <h2>Play</h2>
  <div class="card">
    <div class="now" role="status">Now: <span id="status">Checking…</span></div>
    <div class="grid" id="playlists"><button id="picks" data-choice="picks">My picks</button><button id="photos" data-choice="photos">All uploads</button><button id="black" data-choice="black">Black</button></div>
  </div>
  <div id="message"></div>

  <h2>For how long</h2>
  <select id="until">
    <option value="schedule">Until the schedule changes</option>
    <option value="15">15 minutes</option>
    <option value="30">30 minutes</option>
    <option value="60">60 minutes</option>
    <option value="cleared" selected>Until switched back</option>
  </select>

  <h2>My picks</h2>
  <div class="card">
    <div class="hint">Tick what you'd like on the window. They play in the order you tick them, round and round. Each tick is saved straight away.</div>
    <div id="picklist">Loading…</div>
    <div class="pickbar"><div id="picknote" role="status" aria-live="polite"></div></div>
  </div>

  <h2>Preview a season</h2>
  <div class="row">
    <select id="preview"></select>
    <button id="preview-go">Preview</button>
  </div>

  <h2>Add photos or videos</h2>
  <div class="card">
    <div id="add-off" hidden>Adding photos is off until a PIN is set on the box.</div>
    <div id="add-on">
      <input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN">
      <label class="pick">Add photos or videos<input id="files" type="file" accept="image/*,video/*" multiple></label>
      <div id="progress"></div>
    </div>
  </div>

  <h2>Photos and videos added</h2>
  <div id="uploads" class="uploads"></div>

  <h2>Schedule</h2>
  <button class="primary" id="schedule">Back to schedule</button>

  <h2>Videos</h2>
  <button id="sync">Sync now</button>

  <h2>Recent activity</h2>
  <div class="card"><div id="log">Loading…</div></div>
</main>
<script>
  const $ = (id) => document.getElementById(id);
  const say = (text, error) => { $('message').textContent = text; $('message').className = error ? 'error' : ''; };
  const label = (name) => name.split('/').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ');

  async function post(path, body) {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      const data = await r.json();
      say(data.message || data.error, !r.ok);
      setTimeout(refresh, 1500);
      return Object.assign({ ok: r.ok }, data);
    } catch (e) { say("Couldn't reach the box.", true); return { ok: false, error: "Couldn't reach the box." }; }
  }
  const show = (target) => post('/api/show', { target, until: $('until').value });

  function button(text, onClick, cls) {
    const b = document.createElement('button');
    b.textContent = text;
    if (cls) b.className = cls;
    b.onclick = onClick;
    return b;
  }

  // Changes an element's text only when it differs, so a screen reader
  // doesn't read a status line out again on every poll.
  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }

  // Outlines the Play button for what is on the window (none for null).
  function outline(on) {
    for (const b of $('playlists').querySelectorAll('button')) {
      const yes = b.dataset.choice === on;
      b.classList.toggle('current', yes);
      if (yes) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
  }

  async function refresh() {
    try {
      const r = await (await fetch('/api/status')).json();
      setText($('status'), r.status || 'The box has not started yet.');
      outline(playingChoice(r.status, playlistNames));
      // Keeps "Showing on the window now" under My picks true.
      const was = $('picknote').className;
      if (pending === 0 && was !== 'error') notePicks(was === 'saved' ? 'saved' : undefined);
    } catch (e) { setText($('status'), "Couldn't reach the box."); outline(null); }
    try {
      const l = await (await fetch('/api/log')).json();
      $('log').textContent = l.lines.length ? l.lines.join('\\n') : 'Nothing yet.';
    } catch (e) { /* the status line already says the box can't be reached */ }
  }

  let playlistNames = []; // the schedule's playlists, for outlining the playing one
  async function load() {
    const c = await (await fetch('/api/choices')).json();
    const grid = $('playlists');
    playlistNames = c.playlists;
    for (const p of c.playlists) {
      const b = button(label(p), () => show(p));
      b.dataset.choice = p;
      grid.insertBefore(b, $('picks'));
    }
    refresh();
    for (const p of c.previews) {
      const o = document.createElement('option');
      o.value = p; o.textContent = label(p);
      $('preview').appendChild(o);
    }
  }

  // ---- Adding and removing photos ----

  const PIN_KEY = 'tvbox-upload-pin';
  const remember = (pin) => { try { localStorage.setItem(PIN_KEY, pin); } catch (e) { /* not kept */ } };
  function forgetPin() {
    try { localStorage.removeItem(PIN_KEY); } catch (e) { /* nothing kept */ }
    $('pin').value = '';
    $('pin').focus();
  }
  try { $('pin').value = localStorage.getItem(PIN_KEY) || ''; } catch (e) { /* type it */ }
  const refusedPin = (error) => error === 'Wrong PIN.' || /^Too many wrong PINs/.test(error || '');

  const api = {
    async check(pin, files) {
      try {
        const r = await fetch('/api/uploads/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Upload-Pin': pin },
          body: JSON.stringify({ files: files.map((f) => ({ name: f.name, bytes: f.size })) }),
        });
        const d = await r.json();
        return { ok: r.ok, message: d.message, error: d.error };
      } catch (e) { return { ok: false, error: "Couldn't reach the box." }; }
    },
    upload(file, pin, onProgress) {
      return new Promise((resolve) => {
        const x = new XMLHttpRequest();
        x.open('POST', '/api/uploads?name=' + encodeURIComponent(file.name));
        x.setRequestHeader('X-Upload-Pin', pin);
        x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total)); };
        x.onload = () => {
          let d = {};
          try { d = JSON.parse(x.responseText); } catch (e) { /* no answer */ }
          resolve({ ok: x.status === 200, message: d.message, error: d.error || 'The box refused it.' });
        };
        x.onerror = () => resolve({ ok: false, error: 'The upload stopped. Keep this page open while it sends, then try again.' });
        x.send(file);
      });
    },
  };

  const rows = {};
  const ui = {
    say,
    forgetPin,
    progress(name, text) {
      if (!rows[name]) {
        rows[name] = document.createElement('div');
        $('progress').appendChild(rows[name]);
      }
      rows[name].textContent = name + ': ' + text;
    },
  };

  $('files').onchange = async () => {
    const files = Array.from($('files').files);
    $('files').value = '';
    if (!files.length) return;
    const pin = $('pin').value.trim();
    if (!pin) { say('Type the PIN first.', true); $('pin').focus(); return; }
    remember(pin);
    $('progress').textContent = '';
    for (const k of Object.keys(rows)) delete rows[k];
    await sendBatch(files, pin, api, ui);
    loadUploads();
    loadPicks();
  };

  async function removeUpload(name) {
    const pin = $('pin').value.trim();
    if (!pin) { say('Type the PIN first.', true); $('pin').focus(); return; }
    try {
      const r = await fetch('/api/uploads/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Upload-Pin': pin },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      say(d.message || d.error, !r.ok);
      if (refusedPin(d.error)) forgetPin(); else remember(pin);
    } catch (e) { say("Couldn't reach the box.", true); }
    loadUploads();
    loadPicks();
  }

  async function loadUploads() {
    try {
      const d = await (await fetch('/api/uploads')).json();
      $('add-off').hidden = d.pinSet;
      $('add-on').hidden = !d.pinSet;
      const list = $('uploads');
      list.textContent = d.uploads.length ? '' : 'Nothing added yet.';
      for (const u of d.uploads) {
        const item = document.createElement('div');
        item.className = 'upload';
        item.innerHTML = (u.kind === 'photo' ? '<img loading="lazy" alt="">' : '<video preload="metadata" muted playsinline></video>') +
          '<span class="name"></span><button class="remove">Remove</button>';
        const src = '/photos/' + encodeURIComponent(u.name);
        item.firstChild.src = u.kind === 'photo' ? src : src + '#t=0.1';
        item.querySelector('.name').textContent = u.name;
        item.querySelector('.remove').onclick = () => removeUpload(u.name);
        list.appendChild(item);
      }
    } catch (e) { /* the status line already says the box can't be reached */ }
  }

  // ---- My picks ----

  let picks = [];
  const pickRows = {};
  // One save at a time, each sending the list as it is when it goes, so
  // quick ticks arrive in order. After the last one, the box's own list is
  // shown; after a refusal, the list is read from the box again.
  let saving = Promise.resolve();
  let pending = 0;
  // What the picks are and what to do next, under the list.
  function notePicks(state, error) {
    const note = $('picknote');
    const n = picks.length;
    const showing = /^picks /.test($('status').textContent);
    note.className = state === 'saved' ? 'saved' : state === 'error' ? 'error' : '';
    if (state === 'saving') setText(note, 'Saving…');
    else if (state === 'error') setText(note, error);
    else if (n === 0) setText(note, 'Nothing picked yet.');
    else {
      setText(note, (state === 'saved' ? '✓ Saved. ' : '') + (n === 1 ? '1 picked. ' : n + ' picked. ') +
        (showing ? 'Showing on the window now.' : 'Tap My picks under Play to show them.'));
    }
  }
  function savePicks() {
    pending++;
    notePicks('saving');
    saving = saving.then(async () => {
      let saved = null;
      let error = "Couldn't reach the box.";
      try {
        const r = await fetch('/api/picks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picks }) });
        const d = await r.json();
        if (r.ok) saved = d.picks; else error = d.error;
      } catch (e) { /* the box can't be reached */ }
      pending--;
      if (saved === null) notePicks('error', error + ((await loadPicks()) ? ' Your ticks were put back as the box has them.' : ' Your last ticks may not be saved.'));
      else if (pending === 0) { picks = saved; numberPicks(); notePicks('saved'); }
    });
  }
  function numberPicks() {
    for (const [path, row] of Object.entries(pickRows)) {
      const n = picks.indexOf(path);
      row.querySelector('input').checked = n !== -1;
      row.querySelector('.num').textContent = n === -1 ? '' : String(n + 1);
    }
  }
  // Reads the list and the picks from the box. Returns whether it could.
  async function loadPicks() {
    try {
      const d = await (await fetch('/api/picks')).json();
      if (pending > 0) return true; // a save is on its way; its answer wins
      picks = d.picks;
      const list = $('picklist');
      list.textContent = d.items.length ? '' : 'No videos on the box yet.';
      for (const k of Object.keys(pickRows)) delete pickRows[k];
      let group = null;
      for (const item of d.items) {
        if (item.group !== group) {
          group = item.group;
          const h = document.createElement('div');
          h.className = 'group';
          h.textContent = group;
          list.appendChild(h);
        }
        const row = document.createElement('label');
        row.className = 'pickrow';
        row.innerHTML = '<input type="checkbox"><span class="name"></span><span class="num"></span>';
        row.querySelector('.name').textContent = item.path.split('/').pop();
        row.querySelector('input').onchange = () => {
          picks = togglePick(picks, item.path);
          numberPicks();
          savePicks();
        };
        pickRows[item.path] = row;
        list.appendChild(row);
      }
      numberPicks();
      notePicks();
      return true;
    } catch (e) { return false; /* the status line already says the box can't be reached */ }
  }

  $('picks').onclick = () => show('picks');
  $('photos').onclick = () => show('photos');
  $('black').onclick = () => show('black');
  $('preview-go').onclick = () => $('preview').value && show($('preview').value);
  $('schedule').onclick = () => post('/api/schedule');
  $('sync').onclick = () => post('/api/sync');
  load().catch(() => say("Couldn't reach the box.", true));
  loadUploads();
  loadPicks();
  // Back on the page (another phone may have changed the picks meanwhile).
  window.addEventListener('focus', () => { if (pending === 0) loadPicks(); });
  refresh();
  setInterval(refresh, 3000);
</script>
<script>
  // Adding a batch of files: the box checks the whole batch first, then each
  // file is sent in turn. Stops at the first refusal; a wrong PIN or a lock
  // forgets the remembered PIN, so it is asked for again. No page code here,
  // so it can be tried on its own.
  async function sendBatch(files, pin, api, ui) {
    const refusedPin = (error) => error === 'Wrong PIN.' || /^Too many wrong PINs/.test(error || '');
    const checked = await api.check(pin, files);
    if (!checked.ok) {
      ui.say(checked.error, true);
      if (refusedPin(checked.error)) ui.forgetPin();
      return false;
    }
    for (const file of files) {
      ui.progress(file.name, 'Sending…');
      const r = await api.upload(file, pin, (percent) => ui.progress(file.name, 'Sending… ' + percent + '%'));
      ui.progress(file.name, r.ok ? r.message : r.error);
      if (!r.ok) {
        ui.say(r.error, true);
        if (refusedPin(r.error)) ui.forgetPin();
        return false;
      }
    }
    ui.say(files.length === 1 ? 'Added 1 file.' : 'Added ' + files.length + ' files.');
    return true;
  }

  // Which Play button is on the window, from the status line: 'black',
  // 'picks', 'photos', or a schedule playlist ('kid' for halloween/kid or,
  // without seasons, kid). null for anything no button plays, such as a
  // whole season previewed.
  function playingChoice(status, playlists) {
    const key = String(status || '').split(' (')[0];
    if (key === 'black' || key === 'picks' || key === 'photos') return key;
    const playlist = key.split('/').pop();
    return playlists.includes(playlist) ? playlist : null;
  }

  // Ticking an item puts it at the end of the picks; unticking takes it out,
  // and the numbers after it close up.
  function togglePick(picks, path) {
    return picks.includes(path) ? picks.filter((p) => p !== path) : picks.concat([path]);
  }
</script>
</body>
</html>
`;

module.exports = { createWebsite, startWebsite };
