# Proposal

## Why

A phone photo is usually 3:4, and the TV on its side is 9:16, so a photo fitted whole leaves wide black bands above and below it (about a quarter of the screen for a 1536×2048 photo). The person would rather each photo fill the screen, accepting that its edges are cut off.

## What Changes

- **Each photo fills the screen.** mpv zooms a photo until there is no black around it, cropping what doesn't fit, evenly from both sides (for a 3:4 photo, about an eighth of its width each side). It's done per photo, as each is queued (`loadfile <photo> append-play -1 panscan=1.0`), so nothing else changes.
- **Videos stay fitted whole.** The repo's videos are made for the screen, and a phone video (often landscape) would lose most of its picture if cropped, so videos keep black around them as today.
- See-through parts of a PNG still show black.
- README's "Photos are shown whole" becomes "Photos fill the screen; the edges that don't fit are cut off".

## Capabilities

### New Capabilities

### Modified Capabilities
- `box-player`: photos fill the screen, cropping their edges; videos are still fitted whole.

## Impact

- `scheduler/logic.js` (`keepPlaying` queues a photo with `panscan=1.0`), `scheduler/mpv.js` (comment), `scheduler/tests/fake_mpv.js` (per-file options), `scheduler/tests/player.test.js`, the rehearsal (`inside.sh`: mpv has the photo's panscan while it plays), README and the window-display-schedule skill.
