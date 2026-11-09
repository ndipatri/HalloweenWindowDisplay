## Why

The TV hangs on the wall on its side (portrait), and the box always turns the picture for that. Some photos and videos are landscape. The TV is on a mount that turns, and for those it's better to turn the TV itself than to zoom in. Today the box can't be told the TV has been turned. It would keep turning the picture for portrait, so everything would come out sideways.

## What Changes

- **A Portrait / Landscape choice on the website.** You turn the TV on its mount, then tap the matching button. The box turns the picture straight away, without restarting, and remembers the choice through a restart. Like Play, it needs no PIN.
- **Rotation settings.** Portrait keeps `rotate` from `config.js` (90 as shipped). Landscape uses a new `landscapeRotate` (0 as shipped; 180 if that mount turns the TV the other way up).
- **Photos fill the screen only when they match it.** A photo fills the screen only when it's the same shape as the screen: portrait on a portrait TV, landscape on a landscape TV. Any other photo is shown whole, with black around it: a landscape photo on a portrait TV, a square photo, or one the box can't measure. Before this, every photo filled the screen.
- **Measuring photos.** The box reads a photo's shape from the file: a JPEG's or PNG's width and height, turned by its EXIF orientation as phones save it. Nothing new is installed on the box.
- **Videos.** Unchanged: always shown whole, now turned for whichever way the TV faces.
- **When the TV is turned:**
  - The item on screen is turned and set to fill or fit for the new shape.
  - The items queued behind it are queued again for the new shape.
  - A held lone photo stays held.

Decisions taken as defaults (all can change later):
- The choice is saved in `~/video-scheduler/screen.json` on the box. Without that file, the TV is portrait.
- A tilt sensor on the box, or a motorised mount, could later set the same choice. Neither is part of this change.
- What plays is still chosen with Play, tags and filters. Landscape items aren't picked automatically.

## Capabilities

### Modified Capabilities

- `box-player`: "Shows each photo for a set time" fills the screen only with photos of the screen's shape. A new requirement turns the picture for the way the TV faces.
- `override-website`: a new requirement saves which way the TV faces and offers Portrait and Landscape on the page.

## Impact

- **Code:** `scheduler/config.js` (`landscapeRotate`), `scheduler/logic.js` (shape-aware fill; the saved orientation), `scheduler/player.js` (turning mpv and requeuing when it changes), a new `scheduler/photo_size.js` (JPEG/PNG size and EXIF orientation), `scheduler/website.js` (`GET`/`POST /api/screen`, the buttons).
- **Emulator:** its TV view (`scheduler/tests/e2e/emulator/tv.js`) follows the saved orientation.
- **Tests and docs:** `player.test.js`, `website.test.js`, a new `photo_size.test.js`, the rehearsal, the README, and the window-display-schedule skill.
