// The emulator's "TV" on port 8081: a screen showing the newest frame mpv
// saved in /tmp/tv (see ./mpv), black when there is none from the last two
// seconds, with the box's status line underneath. The screen is portrait or
// landscape as chosen under TV on the box's website (screen.json, next to the
// status file). mpv's frames are what goes to the TV's panel, turned by
// config.js's `rotate` (or `landscapeRotate`); the real TV, turned on its
// mount, turns them back, so the page turns them back too.
//   node tv.js <status file> <config.js>
'use strict';
const fs = require('fs');
const http = require('http');

const FRAMES = '/tmp/tv';
const statusFile = process.argv[2];
const box = require(process.argv[3]).box;
const screenFile = require('path').dirname(statusFile) + '/screen.json';

// Which way the TV faces, and how far mpv turns the picture for it.
function screen() {
  let orientation = 'portrait';
  try { if (JSON.parse(fs.readFileSync(screenFile, 'utf8')).orientation === 'landscape') orientation = 'landscape'; } catch (e) { /* portrait */ }
  return { orientation, rotate: Number(orientation === 'landscape' ? box.landscapeRotate : box.rotate) || 0 };
}

// The newest finished frame: the second newest, as mpv may still be
// writing the newest. null if none is recent (mpv idle: black).
function newestFrame() {
  let names;
  try { names = fs.readdirSync(FRAMES).filter((n) => n.endsWith('.jpg')).sort(); } catch (e) { return null; }
  const name = names.length > 1 ? names[names.length - 2] : null;
  if (!name) return null;
  try {
    const st = fs.statSync(FRAMES + '/' + name);
    return Date.now() - st.mtimeMs < 2000 ? fs.readFileSync(FRAMES + '/' + name) : null;
  } catch (e) { return null; }
}

const PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tvBox emulator: TV</title>
<style>
  body { margin: 0; background: #333; color: #ddd; font: 15px system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px; }
  :root { --long: min(80vh, 160vw, 90vw * 16 / 9); --short: calc(var(--long) * 9 / 16); }
  .tv { position: relative; overflow: hidden; background: #000; border: 12px solid #111; border-radius: 6px; }
  .tv.portrait { height: var(--long); width: var(--short); }
  .tv.landscape { width: min(90vw, 80vh * 16 / 9); height: calc(min(90vw, 80vh * 16 / 9) * 9 / 16); }
  .tv img { position: absolute; top: 50%; left: 50%; width: 100%; height: 100%; object-fit: contain; }
  .tv img.side { width: var(--tvh); height: var(--tvw); }
  #status { min-height: 1.3em; text-align: center; }
  a { color: #ffb066; }
</style></head>
<body>
  <div class="tv portrait" id="tv"><img id="frame" alt=""></div>
  <div id="status"></div>
  <div><a href="http://localhost:8080/" id="site">The box's website</a> · a frame about twice a second, no sound</div>
<script>
  document.getElementById('site').href = location.protocol + '//' + location.hostname + ':8080/';
  const img = document.getElementById('frame');
  img.onerror = () => { img.removeAttribute('src'); };
  const tv = document.getElementById('tv');
  // Shapes the TV for the way it faces, and turns the frame back by mpv's
  // turn (a quarter turn swaps the frame's sides).
  function shape(s) {
    tv.className = 'tv ' + s.orientation;
    const side = s.rotate % 180 !== 0;
    img.className = side ? 'side' : '';
    tv.style.setProperty('--tvw', tv.clientWidth + 'px');
    tv.style.setProperty('--tvh', tv.clientHeight + 'px');
    img.style.transform = 'translate(-50%, -50%) rotate(' + (-s.rotate) + 'deg)';
  }
  async function tick() {
    img.src = '/frame.jpg?' + Date.now();
    try {
      const s = await (await fetch('/state')).json();
      shape(s);
      document.getElementById('status').textContent = s.status;
    } catch (e) { /* stopped */ }
  }
  setInterval(tick, 500);
  tick();
</script>
</body></html>
`;

http.createServer((req, res) => {
  const path = req.url.split('?')[0];
  const send = (status, type, body) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  };
  if (path === '/') return send(200, 'text/html', PAGE);
  if (path === '/state') {
    let status = '';
    try { status = fs.readFileSync(statusFile, 'utf8').trim(); } catch (e) { /* not yet */ }
    return send(200, 'application/json', JSON.stringify(Object.assign({ status }, screen())));
  }
  if (path === '/frame.jpg') {
    const frame = newestFrame();
    return frame ? send(200, 'image/jpeg', frame) : send(404, 'text/plain', 'black');
  }
  return send(404, 'text/plain', 'Not found.');
}).listen(8081);
