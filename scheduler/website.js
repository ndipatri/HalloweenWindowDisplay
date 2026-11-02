// The box's website: shows what's on the TV and changes it for a while, as
// `show` did on the Mac. Served by the player at http://<box name>.local/.
// It only writes ~/video-scheduler/override.json; the player reads that file
// every second, so a change shows within a second or two.
'use strict';
const http = require('http');
const { createScheduler } = require('./logic.js');

// Plain names: 'kid', 'christmas', 'christmas/kid'. No hidden names, no
// paths out of the video folder, no quotes or backslashes.
const PLAYLIST_NAME = /^[^/.\\"][^/\\"]*(\/[^/.\\"][^/\\"]*)?$/;

// `options`: { config, videoRoot, now() -> Date, readText, writeText,
//              removeFile, listFolder }
function createWebsite(options) {
  const { config, videoRoot, now, readText, writeText, removeFile, listFolder } = options;
  const logic = createScheduler(Object.assign({ log() {} }, options));
  const isFolder = (p) => listFolder(p) !== null;
  const visible = (name) => !name.startsWith('.');

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
      if (!isFolder(videoRoot + '/' + top)) continue;
      previews.push(top);
      const subs = (listFolder(videoRoot + '/' + top) || []).filter(visible).sort(logic.compareNames);
      for (const sub of subs) {
        if (isFolder(videoRoot + '/' + top + '/' + sub)) previews.push(top + '/' + sub);
      }
    }
    return { playlists, previews };
  }

  function show(body) {
    const target = typeof body.target === 'string' ? body.target.trim() : '';
    const black = target === 'black' || target === 'off';
    if (!black && !PLAYLIST_NAME.test(target)) {
      return fail('Not a playlist name: ' + (target || '(none)') + '. Choose kid, grownup, a season, or a season/playlist.');
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

  function handle({ method, path, body }) {
    const route = method + ' ' + path.split('?')[0];
    if (route === 'GET /') return { status: 200, type: 'text/html', body: PAGE };
    if (route === 'GET /api/status') {
      const text = readText(logic.STATUS_PATH);
      return json(200, { status: text === null ? null : text.trim() });
    }
    if (route === 'GET /api/choices') return json(200, choices());
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

  return { handle, choices };
}

function json(status, value) {
  return { status, type: 'application/json', body: JSON.stringify(value) };
}
function ok(message) { return json(200, { message }); }
function fail(error) { return json(400, { error }); }

// Serves the website. A failure to listen is logged, not fatal: the TV
// keeps playing without it.
function startWebsite(options, port) {
  const site = createWebsite(options);
  const server = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });
    req.on('end', () => {
      let r;
      try {
        r = site.handle({ method: req.method, path: req.url, body });
      } catch (e) {
        options.log('ERROR: Website: ' + e.message);
        r = json(500, { error: 'Something went wrong on the box.' });
      }
      res.writeHead(r.status, { 'Content-Type': r.type + '; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(r.body);
    });
  });
  server.on('error', (e) => options.log('ERROR: Website on port ' + port + ': ' + e.message));
  server.listen(port, () => options.log('Website: http://' + require('os').hostname() + '.local' +
    (port === 80 ? '' : ':' + port) + '/'));
  return server;
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
  #status { font-size: 19px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  button, select { font: inherit; color: var(--text); background: #2c2c2c; border: 1px solid #3a3a3a; border-radius: 10px; padding: 12px; width: 100%; }
  button { cursor: pointer; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #1a1a1a; font-weight: 600; }
  .row { display: flex; gap: 10px; }
  .row > * { flex: 1; }
  #message { min-height: 1.4em; margin-top: 14px; color: var(--accent); }
  #message.error { color: #ff6b6b; }
</style>
</head>
<body>
<main>
  <h1>Window</h1>
  <div class="card"><div id="status">Checking…</div></div>

  <h2>Play</h2>
  <div class="grid" id="playlists"><button id="black">Black</button></div>

  <h2>For how long</h2>
  <select id="until">
    <option value="schedule">Until the schedule changes</option>
    <option value="15">15 minutes</option>
    <option value="30">30 minutes</option>
    <option value="60">60 minutes</option>
    <option value="cleared">Until switched back</option>
  </select>

  <h2>Preview a season</h2>
  <div class="row">
    <select id="preview"></select>
    <button id="preview-go">Preview</button>
  </div>

  <h2>Schedule</h2>
  <button class="primary" id="schedule">Back to schedule</button>

  <div id="message"></div>
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
    } catch (e) { say("Couldn't reach the box.", true); }
  }
  const show = (target) => post('/api/show', { target, until: $('until').value });

  function button(text, onClick, cls) {
    const b = document.createElement('button');
    b.textContent = text;
    if (cls) b.className = cls;
    b.onclick = onClick;
    return b;
  }

  async function refresh() {
    try {
      const r = await (await fetch('/api/status')).json();
      $('status').textContent = r.status || 'The box has not started yet.';
    } catch (e) { $('status').textContent = "Couldn't reach the box."; }
  }

  async function load() {
    const c = await (await fetch('/api/choices')).json();
    const grid = $('playlists');
    for (const p of c.playlists) grid.insertBefore(button(label(p), () => show(p)), $('black'));
    for (const p of c.previews) {
      const o = document.createElement('option');
      o.value = p; o.textContent = label(p);
      $('preview').appendChild(o);
    }
  }

  $('black').onclick = () => show('black');
  $('preview-go').onclick = () => $('preview').value && show($('preview').value);
  $('schedule').onclick = () => post('/api/schedule');
  load().catch(() => say("Couldn't reach the box.", true));
  refresh();
  setInterval(refresh, 3000);
</script>
</body>
</html>
`;

module.exports = { createWebsite, startWebsite };
