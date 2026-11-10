## 1. Measuring videos

- [x] 1.1 Tests for MP4 width and height, the 90° rotation matrix, moov after mdat, an audio track first, and a file that isn't an MP4
- [x] 1.2 `media_size.js` (renamed from `photo_size.js`), with `readMediaSize` choosing by extension

## 2. Playing only matching items

- [x] 2.1 Tests: only matching items play; square and unmeasurable ones play either way; with nothing matching, everything plays whole, logged once; turning the TV moves on from an item that no longer matches
- [x] 2.2 `playlistItems` filters by the TV's shape, falling back to everything

## 3. Rest

- [x] 3.1 Rehearsal: a landscape upload plays alone once the TV is landscape; real clips are measured
- [x] 3.2 README and skills
