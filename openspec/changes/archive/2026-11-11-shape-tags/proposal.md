## Why

The box plays only items the TV's shape, measured from each file. Sometimes the measured shape isn't the one wanted: a landscape video worth showing on the portrait window, or a photo whose shape can't be measured. There was no way to say otherwise.

## What Changes

- **Shape tags.** An item tagged `portrait` or `landscape` (added under Tags on the website, like any other tag) is treated as that shape when the box chooses what plays, instead of its measured shape. An item with both tags, or neither, keeps its measured shape.
- **Shown whole when the shape is overridden.** A photo fills the screen only when its measured shape matches the TV. A photo tagged the other way is shown whole, with black around it, rather than cropped to a sliver.
- **Spec catch-up:** items shown whole are now queued with `panscan=0` (since the flicker fix), not with no `panscan`.

## Capabilities

### Modified Capabilities

- `box-player`: "Plays only items the TV's shape" now takes the shape from a `portrait` or `landscape` tag when an item has one.

## Impact

- **Code:** `scheduler/logic.js` (`itemShape`, and `playlistItems` keeps each item's tags).
- **Tests and docs:** `player.test.js`, the README.
