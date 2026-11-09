## 1. Measuring photos

- [x] 1.1 Tests for JPEG/PNG width and height, with EXIF orientations 1, 6 and 8, and a file that can't be read
- [x] 1.2 `scheduler/photo_size.js`

## 2. Player

- [x] 2.1 Tests: a photo fills the screen only when it matches it; turning to landscape turns mpv, refits the photo on screen and requeues the rest; a box started in landscape turns at once
- [x] 2.2 `landscapeRotate` in config; the saved orientation in logic; shape-aware fill in `keepPlaying`; turning in the player tick

## 3. Website

- [x] 3.1 Tests: `POST /api/screen` saves and logs; refuses an unknown orientation; `GET /api/screen` and the page's buttons
- [x] 3.2 The route and the Portrait / Landscape buttons, marking the current one

## 4. Rest

- [x] 4.1 Emulator TV view follows the orientation
- [x] 4.2 Rehearsal: turning to landscape sets mpv's video-rotate to 0 and back to 90
- [x] 4.3 README and the window-display-schedule skill
