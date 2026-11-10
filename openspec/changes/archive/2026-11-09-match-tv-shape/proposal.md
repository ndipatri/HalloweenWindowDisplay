## Why

When the TV is turned, the box turns the picture, but it still plays whatever was picked. A portrait item on a landscape TV gets black at the sides. To have no black borders, the box should play only the items that match the TV's shape.

## What Changes

- **Measuring videos.** The box now measures videos as well as photos. It reads a video's width and height from its MP4/MOV header, turned by its rotation flag as phones record. Like photos, it's done in Node, so nothing new is installed. `photo_size.js` becomes `media_size.js`.
- **Only matching items play.** Out of what's picked (a schedule's filter, or Play), the box plays only the items the TV's shape: portrait items while the TV is portrait, landscape items while it's landscape. A square item plays either way, shown whole. An item that can't be measured plays only when nothing matches, since it may well not play at all.
- **When nothing matches, the box still plays.** It plays everything picked, shown whole, rather than going black, and logs once: `Nothing in <what> is landscape, so it all plays, shown whole.`
- **When the TV is turned,** an item on screen that no longer matches gives way at once to the next one that does.
- **Unchanged:** matching photos still fill the screen, and videos are still shown whole. What's picked is still chosen with Play, tags and filters.

## Capabilities

### Modified Capabilities

- `box-player`:
  - "Shows each photo for a set time": the scenario for photos of other shapes now covers square and unmeasurable ones, and measuring covers videos.
  - "Turns the picture for the way the TV faces": an item that no longer matches gives way.
  - New requirement: "Plays only items the TV's shape".

## Impact

- **Code:** `scheduler/media_size.js` (was `photo_size.js`, plus MP4/MOV), `scheduler/logic.js` (`playlistItems` filters by shape), `scheduler/player.js`, `scheduler/setup.sh`.
- **Tests and docs:** `media_size.test.js` (was `photo_size.test.js`), `player.test.js`, the rehearsal, the README, and the skills.
