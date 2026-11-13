## 1. The box

- [x] 1.1 Tests: the website adds a photo with no PIN; removes an upload with no PIN; saves the filters with no PIN; the batch, list, removal, filters and tags scenarios without the PIN; the PIN and lock tests go
- [x] 1.2 `website.js`: remove the PIN checks, the lock, `pinSet`, and the headers on the four routes; `config.js`: `pinTries`, `lockMinutes`

## 2. The pages

- [x] 2.1 Tests: the website page offers adding and removing photos (no PIN field); the page sends a batch only after the box clears it; the website page offers editing filters with no PIN; the easy page's scenarios without the PIN
- [x] 2.2 Remove the PIN fields and their code from both pages; forget a remembered PIN

## 3. Setup, emulator, rehearsal, docs

- [x] 3.1 Test and `setup.sh`: setup asks for no upload PIN and removes an old one
- [x] 3.2 `emulate.sh`, the emulator's `inside.sh` and the rehearsal's `inside.sh` without the PIN
- [x] 3.3 README and both skills
