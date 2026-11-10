// Tests for measuring photos and videos (scheduler/media_size.js), run with Node:
//   node scheduler/tests/media_size.test.js
'use strict';
const assert = require('assert');
const { photoSize, videoSize } = require('../media_size.js');

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

// An MP4: boxes as [type, payload]; a box's payload may be a list of boxes.
function box(type, payload) {
  const body = Array.isArray(payload) ? Buffer.concat(payload) : payload;
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length + 8, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body]);
}
// A track header (version 0) with a width, height and turn (0 or 90).
function tkhd(width, height, turn) {
  const b = Buffer.alloc(84);
  const fixed = (n) => (n * 65536) >>> 0;
  const matrix = turn === 90 ? [0, fixed(1), 0, fixed(-1) >>> 0, 0, 0, 0, 0, 0x40000000]
    : [fixed(1), 0, 0, 0, fixed(1), 0, 0, 0, 0x40000000];
  matrix.forEach((v, i) => b.writeUInt32BE(v >>> 0, 40 + i * 4));
  b.writeUInt32BE(fixed(width), 76);
  b.writeUInt32BE(fixed(height), 80);
  return box('tkhd', b);
}
function mp4(tracks, moovLast) {
  const ftyp = box('ftyp', Buffer.from('isom\0\0\0\0isomiso2', 'latin1'));
  const moov = box('moov', [box('mvhd', Buffer.alloc(100))].concat(tracks.map((t) => box('trak', [t, box('mdia', Buffer.alloc(8))]))));
  const mdat = box('mdat', Buffer.alloc(64));
  return Buffer.concat(moovLast ? [ftyp, mdat, moov] : [ftyp, moov, mdat]);
}

test("a video's shape is measured the way it is shown", () => {
  assert.deepEqual(videoSize(mp4([tkhd(1920, 1080, 90)])), { width: 1080, height: 1920 });
  assert.deepEqual(videoSize(mp4([tkhd(1920, 1080, 0)])), { width: 1920, height: 1080 });
  assert.deepEqual(videoSize(mp4([tkhd(1920, 1080, 0)], true)), { width: 1920, height: 1080 }, 'moov after mdat');
  assert.deepEqual(videoSize(mp4([tkhd(0, 0, 0), tkhd(1920, 1080, 0)])), { width: 1920, height: 1080 }, 'audio track first');
  assert.equal(videoSize(Buffer.from('not a video at all, not even close')), null);
  assert.equal(videoSize(Buffer.alloc(0)), null);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
