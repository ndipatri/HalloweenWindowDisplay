## Why

When the only thing to play is one photo (one upload picked under Play, or a tag with one photo), the box queues that photo again and again. mpv closes and reopens it every 10 seconds, and the TV flashes black each time.

## What Changes

- When the only item to play is a photo, the box queues it once and holds it on screen, instead of reloading it every `photoSeconds`.
- As soon as something else is to play (an upload added, a tag changed, the photo removed), the held photo gives way: what comes next is queued first, so mpv moves straight on rather than going black.
- A lone video is unchanged (it is still queued round and round).

## Capabilities

### Modified Capabilities

- `box-player`: "Shows each photo for a set time" adds that a lone photo is held on screen and gives way when something else is to play.

## Impact

- `scheduler/logic.js` (`keepPlaying`, `setAside`, the playlist state), `scheduler/tests/player.test.js`, `scheduler/tests/e2e/inside.sh`.
