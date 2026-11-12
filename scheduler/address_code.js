// The QR code of the box's website address that the TV shows as each item
// starts (see player.js). Made with qrencode (setup installs it) and drawn
// here as raw BGRA pixels, which mpv's overlay-add takes.
'use strict';
const { execFile } = require('child_process');
const os = require('os');

// The box's IPv4 address on the home network: Wi-Fi first, then wired, then
// any other; null with none.
function boxAddress(interfaces = os.networkInterfaces()) {
  const found = (name) => ((interfaces[name] || []).find((a) => (a.family === 'IPv4' || a.family === 4) && !a.internal) || {}).address;
  const names = ['wlan0', 'eth0'].concat(Object.keys(interfaces).filter((n) => n !== 'wlan0' && n !== 'eth0'));
  for (const n of names) {
    const a = found(n);
    if (a) return a;
  }
  return null;
}

// The website's address, http://<address>/ (with the port when it isn't 80).
function addressUrl(address, port = 80) {
  if (!address) return null;
  return 'http://' + address + (port === 80 ? '' : ':' + port) + '/';
}

// qrencode's text output (-t ASCII: "##" for a dark module, two spaces for a
// light one, a line per row) as rows of true (dark) and false.
function readGrid(text) {
  const rows = String(text).split('\n').filter((l) => l.length);
  const width = Math.max(...rows.map((l) => l.length)) / 2;
  if (!rows.length || rows.length !== width) throw new Error("qrencode's output isn't a square code");
  return rows.map((l) => {
    const row = [];
    for (let i = 0; i < width; i++) row.push(l.slice(2 * i, 2 * i + 2) === '##');
    return row;
  });
}

// The code as BGRA pixels: black and white modules, each the same whole
// number of pixels, inside a white border `border` modules wide, at most
// `maxSize` pixels square. { size, stride, pixels }.
function drawCode(grid, maxSize = 120, border = 2) {
  const modules = grid.length + 2 * border;
  const scale = Math.floor(maxSize / modules);
  if (scale < 1) throw new Error('the code is too big for ' + maxSize + ' pixels');
  const size = modules * scale;
  const stride = size * 4;
  const pixels = Buffer.alloc(size * stride, 255); // white, opaque
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid.length; x++) {
      if (!grid[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = ((border + y) * scale + dy) * stride + (border + x) * scale * 4;
        for (let dx = 0; dx < scale; dx++) pixels.fill(0, row + dx * 4, row + dx * 4 + 3); // B, G, R; alpha stays 255
      }
    }
  }
  return { size, stride, pixels };
}

// Where on the panel (width x height, as mpv's OSD has it) to put a code
// `size` pixels square so that it is in the bottom-right corner for someone
// looking at the TV, with the picture turned `degrees` clockwise. The panel
// itself isn't turned, so the viewer's bottom-right is a different corner of
// it for each turn.
function codeCorner(degrees, width, height, size, margin = 24) {
  const left = margin;
  const right = width - size - margin;
  const top = margin;
  const bottom = height - size - margin;
  const corners = { 0: [right, bottom], 90: [left, bottom], 180: [left, top], 270: [right, top] };
  const [x, y] = corners[((degrees % 360) + 360) % 360] || corners[0];
  return { x, y };
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || '').trim() || error.message));
      else resolve(stdout);
    });
  });
}

// The code for `url`, drawn at most `maxSize` pixels square.
async function makeAddressCode(url, maxSize = 120, runner = run) {
  const text = await runner('qrencode', ['-t', 'ASCII', '-m', '0', '-l', 'M', url]);
  return drawCode(readGrid(text), maxSize);
}

module.exports = { boxAddress, addressUrl, readGrid, drawCode, codeCorner, makeAddressCode };
