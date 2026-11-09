// Tests for measuring photos (scheduler/photo_size.js), run with Node:
//   node scheduler/tests/photo_size.test.js
'use strict';
const assert = require('assert');
const { photoSize } = require('../photo_size.js');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// A JPEG's headers: an EXIF orientation (none when null), in big- or
// little-endian TIFF, then the frame header with its width and height.
function jpeg(width, height, orientation, littleEndian) {
  const parts = [Buffer.from([0xff, 0xd8])];
  // A JFIF segment first, as cameras write, to be skipped.
  parts.push(Buffer.from([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
  if (orientation !== null) {
    const le = littleEndian;
    const u16 = (n) => (le ? [n & 255, n >> 8] : [n >> 8, n & 255]);
    const u32 = (n) => (le ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
    const tiff = Buffer.from([].concat(
      le ? [0x49, 0x49] : [0x4d, 0x4d], u16(42), u32(8),
      u16(2), // two entries: one that isn't orientation, then orientation
      u16(0x010f), u16(2), u32(4), [0x41, 0x42, 0x43, 0],
      u16(0x0112), u16(3), u32(1), u16(orientation), [0, 0],
      u32(0)));
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
    parts.push(Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body);
  }
  parts.push(Buffer.from([0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, 3,
    1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]));
  parts.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

function png(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0, 0, 0, 13]), Buffer.from('IHDR'), ihdr, Buffer.alloc(4)]);
}

test('a photo stored on its side is measured the way it is shown', () => {
  assert.deepEqual(photoSize(jpeg(160, 96, 6, false)), { width: 96, height: 160 });
  assert.deepEqual(photoSize(jpeg(160, 96, 8, true)), { width: 96, height: 160 });
  assert.deepEqual(photoSize(jpeg(160, 96, 1, false)), { width: 160, height: 96 });
  assert.deepEqual(photoSize(jpeg(160, 96, null)), { width: 160, height: 96 });
  assert.deepEqual(photoSize(png(1080, 1920)), { width: 1080, height: 1920 });
  assert.equal(photoSize(Buffer.from('not a photo at all')), null);
  assert.equal(photoSize(jpeg(160, 96, 6, false).subarray(0, 30)), null, 'cut off before its size');
  assert.equal(photoSize(Buffer.alloc(0)), null);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
