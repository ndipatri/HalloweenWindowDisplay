## Context

`followCode` in `player.js` runs each tick. It shows the code when the current mpv playlist entry's `id` changes and takes it away after `addressCode.seconds`. A lone photo is queued once with `image-display-duration=inf`, so its entry never changes and the code showed only once.

## Decisions

**"A single item" is what's playing having one item.** `logic.playlistItems(active).items.length === 1`: the same list `keepPlaying` queues from, after the TV-shape filtering. It is read each tick, so adding a second upload, or turning the TV so only one item fits, changes it at once.

**With a single item the code isn't timed out.** While it's up, only switching it off or the screen going black takes it away (and a turn, which moves its corner). While it's down and the item is single and the switch is on, it is shown again; tries are at most `addressCode.seconds` apart (`code.lastShow`, set at the top of `showCode`), so a box with no address or no `qrencode` doesn't retry every tick.

**Two or more items: unchanged.** 3 seconds as each starts. When a second item is added to a single one, the code (up longer than 3 seconds by then) comes down at the next tick.

**The every-10-seconds repeat is dropped.** It was the first fix for the same problem; on the real TV, a code flashing every 10 seconds was more distracting than one that simply stays. `addressCode.every` is removed from `config.js`.

## Risks

- A single long video also keeps the code up the whole time. That's the same case (someone walks up mid-item) and the switch turns it off.
