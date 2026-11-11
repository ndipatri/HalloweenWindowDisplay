## Why

After the TV was turned, a photo could stay on screen about 20 seconds, and the one after it never appeared: on the box, after a turn to portrait at 6:19:52 PM, mpv moved from the bike photo to the pizza at 6:20:03 and to the coffee at 6:20:13, but the TV showed the bike until the coffee. Turning to landscape flashed through several photos at once. mpv drew every photo on time (its screenshots show it); the frames waited in its display queue (`swapchain-depth`, 3 frames by default). A still photo is drawn only once or twice, so its frame could sit there until later frames pushed it out.

## What Changes

- mpv keeps at most one drawn frame waiting (`--swapchain-depth=1`), so each photo reaches the TV as soon as it is drawn. Set by hand on the running box, it made the photos after a turn show on time.

## Capabilities

### Modified Capabilities

- `box-player`: a new requirement, "Puts each picture on the TV as soon as it is drawn".

## Impact

- **Code:** `scheduler/mpv.js` (one mpv option).
- **Tests:** `player.test.js`.
