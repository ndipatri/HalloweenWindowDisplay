// A photo's or video's width and height as it is shown: a JPEG's or PNG's
// size from its headers, turned by a JPEG's EXIF orientation (how phones
// store a photo taken on its side), or an MP4/MOV's from its video track
// header, turned by its rotation matrix (how phones record a video held
// upright). Node only, nothing to install.
'use strict';
const fs = require('fs');

// { width, height } from a photo's first bytes, or null when they aren't a
// JPEG or PNG with its size in them.
function photoSize(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('latin1', 12, 16) === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let orientation = 1;
  let at = 2;
  while (at + 4 <= buf.length) {
    if (buf[at] !== 0xff) return null;
    const marker = buf[at + 1];
    if (marker === 0xff) { at++; continue; } // padding
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { at += 2; continue; }
    const length = buf.readUInt16BE(at + 2);
    const start = at + 4;
    if (marker === 0xe1 && start + length - 2 <= buf.length && buf.toString('latin1', start, start + 6) === 'Exif\0\0') {
      orientation = exifOrientation(buf.subarray(start + 6, start + length - 2)) || orientation;
    }
    // A frame header (SOF0-15, but not DHT C4, JPG C8 or DAC CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (start + 5 > buf.length) return null;
      const height = buf.readUInt16BE(start + 1);
      const width = buf.readUInt16BE(start + 3);
      if (!width || !height) return null;
      // 5 to 8: stored turned a quarter, so shown with width and height swapped.
      return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
    }
    if (marker === 0xda || marker === 0xd9) return null; // the picture itself, with no frame header before it
    at = start + length - 2;
  }
  return null;
}

// The orientation tag (0x0112) from a TIFF block, or null.
function exifOrientation(tiff) {
  if (tiff.length < 8) return null;
  const le = tiff.toString('latin1', 0, 2) === 'II';
  if (!le && tiff.toString('latin1', 0, 2) !== 'MM') return null;
  const u16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return null;
}

// { width, height } of an MP4/MOV's first video track (one with a size),
// turned a quarter when its matrix says so, from a buffer holding at least
// its moov box; null when there is none.
function videoSize(buf) {
  if (!buf) return null;
  return trackSize(buf, 0, buf.length, 0);
}

const CONTAINERS = new Set(['moov', 'trak']);
function trackSize(buf, start, end, depth) {
  let at = start;
  while (at + 8 <= end) {
    let size = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    let head = 8;
    if (size === 1) {
      if (at + 16 > end) return null;
      size = Number(buf.readBigUInt64BE(at + 8));
      head = 16;
    } else if (size === 0) size = end - at;
    if (size < head || at + size > end) return null;
    if (type === 'tkhd') {
      const found = tkhdSize(buf.subarray(at + head, at + size));
      if (found) return found;
    } else if (CONTAINERS.has(type) && depth < 4) {
      const found = trackSize(buf, at + head, at + size, depth + 1);
      if (found) return found;
    }
    at += size;
  }
  return null;
}

// A track header's display size, or null for a track with none (audio).
function tkhdSize(b) {
  const version = b[0];
  const matrixAt = version === 1 ? 52 : 40;
  if (b.length < matrixAt + 44) return null;
  const width = b.readUInt32BE(matrixAt + 36) / 65536;
  const height = b.readUInt32BE(matrixAt + 40) / 65536;
  if (!width || !height) return null;
  const a = b.readInt32BE(matrixAt);
  const d = b.readInt32BE(matrixAt + 16);
  // a and d are 0 for a quarter turn (90 or 270 degrees).
  const quarter = a === 0 && d === 0;
  return quarter ? { width: Math.round(height), height: Math.round(width) } : { width: Math.round(width), height: Math.round(height) };
}

// A video file's size: finds the moov box among the top-level boxes (it
// can come before or after the media) and reads only that.
function readVideoSize(path) {
  let fd;
  try {
    fd = fs.openSync(path, 'r');
    const total = fs.fstatSync(fd).size;
    const head = Buffer.alloc(16);
    let at = 0;
    while (at + 8 <= total) {
      fs.readSync(fd, head, 0, 16, at);
      let size = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      if (size === 1) size = Number(head.readBigUInt64BE(8));
      else if (size === 0) size = total - at;
      if (size < 8) return null;
      if (type === 'moov') {
        if (size > 64 * 1024 * 1024) return null;
        const moov = Buffer.alloc(Math.min(size, total - at));
        fs.readSync(fd, moov, 0, moov.length, at);
        return videoSize(moov);
      }
      at += size;
    }
    return null;
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// A photo file's size, reading as little of it as needed: the headers come
// first, though a big EXIF block (a thumbnail) can push the size further in.
function readPhotoSize(path) {
  let fd;
  try {
    fd = fs.openSync(path, 'r');
    const total = fs.fstatSync(fd).size;
    for (const want of [256 * 1024, total]) {
      const length = Math.min(want, total);
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, 0);
      const size = photoSize(buf);
      if (size || length === total) return size;
    }
    return null;
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// Either, by the file's extension.
function readMediaSize(path) {
  return /\.(jpe?g|png)$/i.test(path) ? readPhotoSize(path) : readVideoSize(path);
}

module.exports = { photoSize, videoSize, readPhotoSize, readVideoSize, readMediaSize };
