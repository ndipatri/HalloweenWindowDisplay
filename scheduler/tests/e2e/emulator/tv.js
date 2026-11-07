// The emulator's "TV" on port 8081: a portrait screen showing the newest
// frame mpv saved in /tmp/tv (see ./mpv), black when there is none from the
// last two seconds, with the box's status line underneath. mpv's frames are
// what goes to the TV's panel, turned by config.js's `rotate`; the real TV
// stands on its side, which turns them back, so the page turns them back too.
//   node tv.js <status file> <config.js>
'use strict';
const fs = require('fs');
const http = require('http');

const FRAMES = '/tmp/tv';
const statusFile = process.argv[2];
const rotate = Number(require(process.argv[3]).box.rotate) || 0;

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
  :root { --h: min(80vh, 160vw); --w: calc(var(--h) * 9 / 16); }
  .tv { position: relative; overflow: hidden; height: var(--h); width: var(--w); background: #000; border: 12px solid #111; border-radius: 6px; }
  .tv img { position: absolute; top: 50%; left: 50%; object-fit: contain; transform: translate(-50%, -50%) rotate(-ROTATEdeg); }
  .tv img.side { width: var(--h); height: var(--w); }
  .tv img.up { width: var(--w); height: var(--h); }
  #status { min-height: 1.3em; text-align: center; }
  a { color: #ffb066; }
</style></head>
<body>
  <div class="tv"><img id="frame" alt="" class="SHAPE"></div>
  <div id="status"></div>
  <div><a href="http://localhost:8080/" id="site">The box's website</a> · a frame about twice a second, no sound</div>
<script>
  document.getElementById('site').href = location.protocol + '//' + location.hostname + ':8080/';
  const img = document.getElementById('frame');
  img.onerror = () => { img.removeAttribute('src'); };
  async function tick() {
    img.src = '/frame.jpg?' + Date.now();
    try { document.getElementById('status').textContent = await (await fetch('/status')).text(); } catch (e) { /* stopped */ }
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
  if (path === '/') {
    return send(200, 'text/html', PAGE.replace('ROTATE', String(rotate)).replace('SHAPE', rotate % 180 ? 'side' : 'up'));
  }
  if (path === '/status') {
    let text = '';
    try { text = fs.readFileSync(statusFile, 'utf8').trim(); } catch (e) { /* not yet */ }
    return send(200, 'text/plain', text);
  }
  if (path === '/frame.jpg') {
    const frame = newestFrame();
    return frame ? send(200, 'image/jpeg', frame) : send(404, 'text/plain', 'black');
  }
  return send(404, 'text/plain', 'Not found.');
}).listen(8081);
