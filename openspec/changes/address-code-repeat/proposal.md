## Why

The address code shows when a new item starts. When only one photo is playing, it is put on screen once and held, so nothing new ever starts: the code shows for 3 seconds and never again, and someone who walks up later can't find the box's address.

## What Changes

- **The code comes back while one item stays on screen.** Every 10 seconds (`addressCode.every`, the same as a photo's time in a rotation) after the code was last shown, with the same item still on screen, the code is shown again for its 3 seconds. A lone photo, or anything else held on screen, then looks the same as a rotation of photos. A new item still shows it at once, and starts the 10 seconds again.
- Switched off, with no address, or on black: no code, as before. Switching it back on shows it within 10 seconds instead of at the next item.

## Capabilities

### Modified Capabilities

- `box-player`: shows the address code again every 10 seconds while one item stays on screen.

## Impact

- **Code:** `scheduler/player.js` (`followCode`), `scheduler/config.js` (`addressCode.every`).
- **Tests and docs:** `player.test.js`, the README and the schedule skill.
