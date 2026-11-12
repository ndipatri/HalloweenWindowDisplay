## Why

With nothing playing the TV's shape (say, only portrait photos left and the TV turned landscape), the box played them all anyway, shown whole with black around. On the window that looked like a mistake: portrait photos on a landscape TV. Black is wanted instead.

## What Changes

- **Black when nothing fits.** When none of the picked items is the TV's shape, the screen goes black, and the box logs once `Nothing in … is landscape. Showing black until something is, or the TV is turned back.` It plays again as soon as something fits: the TV turned back, a fitting upload, or a `portrait`/`landscape` tag.
- **Items that can't be measured don't play** (they used to be the fallback). The log says to tag one `portrait` or `landscape` to play it.

## Capabilities

### Modified Capabilities

- `box-player`: "Plays only items the TV's shape" (black instead of everything) and "Shows each photo for a set time" (a photo is shown whole when square or tagged with a shape it isn't).

## Impact

- **Code:** `scheduler/logic.js` (`playlistItems`).
- **Tests and docs:** `player.test.js`, the README, the schedule skill.
