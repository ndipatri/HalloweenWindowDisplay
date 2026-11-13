## Why

The address code shows for 3 seconds when a new item starts. When only one item is playing, a photo is put on screen once and held, so nothing new ever starts: the code showed once and never again, and someone who walks up later can't find the box's address. A first fix (merged, not archived) brought it back every 10 seconds; on the real TV that flashing was worse than just leaving it up.

## What Changes

- **With a single item to play, the code stays up the whole time.** When what's playing has only one item (one upload picked under Play, say), the code is shown when it starts and left up, in the TV's bottom-right corner, until a second item is added, the screen goes black, or it's switched off. If it comes down while that item stays (switched back on, the TV turned), it goes straight back up.
- **With two or more items, nothing changes:** 3 seconds as each one starts.
- **The every-10-seconds repeat is removed** (`addressCode.every` goes), replaced by the above.

## Capabilities

### Modified Capabilities

- `box-player`: keeps the address code up while a single item plays.

## Impact

- **Code:** `scheduler/player.js` (`followCode`), `scheduler/config.js` (`addressCode.every` removed).
- **Tests and docs:** `player.test.js`, the README and the schedule skill.
