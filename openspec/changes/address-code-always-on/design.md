## Context

`followCode` in `player.js` runs each tick and draws the code with `overlay-add 1 …` (an mpv OSD overlay, which stays until `overlay-remove 1`, across playlist entries). Today it shows it when the current entry's `id` changes and removes it after `addressCode.seconds`, unless what's playing has a single item.

## Decisions

**Up whenever something plays.** Each tick: if what's playing has no items (black, including "nothing fits the TV's shape"), or the switch is off, remove it. Otherwise, when mpv has a current entry: on a new entry, redraw only if the code isn't up or the address changed (so an item change never blinks it); if it's down (after a turn, switched back on, or no address before), draw it, trying at most every 3 seconds (`CODE_RETRY_MS`) so a box with no address or no `qrencode` doesn't retry every tick.

**Between items it is left alone.** For a moment while mpv loads the next item there may be no current entry; the code is neither drawn nor removed then, so it doesn't flicker.

**`addressCode.seconds` and the single-item rule go.** Both are replaced by the one rule. The single-item requirement and the "as each item starts" requirement are removed from `box-player` and replaced by "Keeps its address on the TV while something plays", which keeps the scenarios that still hold (corner, QR code, new address, switched off, black, qrencode) under the same names.

## Testability

All scenarios go through `player.test.js`'s `codeBox` (fake mpv with overlays) and `address_code.test.js`/`setup.test.js` as before.

## Rehearsal

The change touches `player.js`. `inside.sh`'s "and taken away 3 to 4 seconds later" check becomes "and still up after the next item starts"; the others (drawn top-right of the panel, switched off, back on, black) stay.

## Box-only

On the real TV: the code stays put while photos change, with no blink at each change.
