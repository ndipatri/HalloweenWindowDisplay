// Tests for the address code (scheduler/address_code.js), run with Node:
//   node scheduler/tests/address_code.test.js
// qr-10.0.0.25.txt is qrencode's real output for http://10.0.0.25/.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { boxAddress, addressUrl, readGrid, drawCode, codeCorner, makeAddressCode } = require('../address_code.js');

const QR_TEXT = fs.readFileSync(path.join(__dirname, 'qr-10.0.0.25.txt'), 'utf8');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('the address code is a QR code of the box\'s address', async () => {
  const runs = [];
  const code = await makeAddressCode('http://10.0.0.25/', 120, async (cmd, args) => { runs.push([cmd].concat(args)); return QR_TEXT; });
  assert.deepEqual(runs, [['qrencode', '-t', 'ASCII', '-m', '0', '-l', 'M', 'http://10.0.0.25/']]);
  const grid = readGrid(QR_TEXT);
  assert.equal(grid.length, 25);
  // 25 modules and a 2-module border: 29 modules of 4 pixels.
  assert.equal(code.size, 116);
  assert.ok(code.size <= 120);
  assert.equal(code.stride, 116 * 4);
  const scale = 4;
  const px = (x, y) => Array.from(code.pixels.subarray(y * code.stride + x * 4, y * code.stride + x * 4 + 4));
  const WHITE = [255, 255, 255, 255];
  const BLACK = [0, 0, 0, 255];
  // The border is white all round.
  for (let i = 0; i < code.size; i += 7) {
    for (const [x, y] of [[i, 0], [i, 7], [0, i], [7, i], [i, code.size - 1], [code.size - 1, i]]) {
      assert.deepEqual(px(x, y), WHITE, 'border at ' + x + ',' + y);
    }
  }
  // Every pixel of every module is the module's colour.
  for (let my = 0; my < 25; my++) {
    for (let mx = 0; mx < 25; mx++) {
      const want = grid[my][mx] ? BLACK : WHITE;
      for (const [dx, dy] of [[0, 0], [3, 0], [0, 3], [3, 3], [1, 2]]) {
        assert.deepEqual(px((2 + mx) * scale + dx, (2 + my) * scale + dy), want, 'module ' + mx + ',' + my);
      }
    }
  }
  // The finder pattern's corner is dark, as in any QR code.
  assert.equal(grid[0][0], true);
  assert.throws(() => readGrid('##  \n'), /square/);
});

test('the address code sits bottom-right however the TV faces', () => {
  assert.deepEqual(codeCorner(0, 1920, 1080, 116), { x: 1920 - 116 - 24, y: 1080 - 116 - 24 });
  assert.deepEqual(codeCorner(90, 1920, 1080, 116), { x: 24, y: 1080 - 116 - 24 });
  assert.deepEqual(codeCorner(180, 1920, 1080, 116), { x: 24, y: 24 });
  assert.deepEqual(codeCorner(270, 1920, 1080, 116), { x: 1920 - 116 - 24, y: 24 });
});

test('the box finds its address on the home network', () => {
  const lo = [{ address: '127.0.0.1', family: 'IPv4', internal: true }];
  const v6 = { address: 'fe80::1', family: 'IPv6', internal: false };
  assert.equal(boxAddress({ lo, wlan0: [v6, { address: '10.0.0.25', family: 'IPv4', internal: false }],
    eth0: [{ address: '192.168.1.5', family: 'IPv4', internal: false }] }), '10.0.0.25');
  assert.equal(boxAddress({ lo, eth0: [{ address: '192.168.1.5', family: 'IPv4', internal: false }] }), '192.168.1.5');
  assert.equal(boxAddress({ lo, docker0: [{ address: '172.17.0.2', family: 4, internal: false }] }), '172.17.0.2');
  assert.equal(boxAddress({ lo, wlan0: [v6] }), null);
  assert.equal(addressUrl('10.0.0.25'), 'http://10.0.0.25/');
  assert.equal(addressUrl('10.0.0.25', 8080), 'http://10.0.0.25:8080/');
  assert.equal(addressUrl(null), null);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
