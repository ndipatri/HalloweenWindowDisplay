## Context

`followCode` in `player.js` runs each tick. It shows the code when the current mpv playlist entry's `id` changes and takes it away after `addressCode.seconds`. A lone photo is queued once with `image-display-duration=inf`, so its entry never changes.

## Decisions

**Repeat from the last time the code was shown, not from when the item started.** The player notes when it last tried to show the code (`code.lastShow`, set at the top of `showCode`, so it covers attempts cut short by the switch being off or no address). When the code is down, the item is unchanged and `addressCode.every` seconds (10) have passed since then, it shows it again. A new item still shows it at once and so starts the 10 seconds again; in a rotation of 10-second photos the code therefore shows exactly as before, once per photo.

**10 seconds, its own setting.** It matches `photoSeconds` as shipped, so a held photo looks like a rotation of the same photo, but it is a separate setting (`addressCode.every`), so changing how long photos stay up doesn't change it. `every: 0` or missing turns the repeat off.

**Nothing else changes.** The switch, black screen and turning the TV behave as before; after a turn the code comes back in the new corner within 10 seconds even when the item stays.

## Risks

- A long video also gets the code every 10 seconds. That's wanted: it is the same "someone walks up mid-item" case.
