## Why

The address code shows for 3 seconds as each item starts (the whole time only when a single item plays). With photos changing every 10 seconds that makes it flash on and off every 10 seconds, which on the real TV is unbearable. Now that the code opens the easy page, it should simply always be there.

## What Changes

- **The code stays on screen the whole time something plays**, from item to item, without being redrawn (so it never blinks). It comes down only when it's switched off on the website, or when nothing is playing (black). Turning the TV moves it to the new corner straight away.
- **No more timing:** `addressCode.seconds` goes from `config.js`, and the single-item rule from the last change is folded in (it is now the rule for everything).
- A new address still shows when the next item starts.

## Capabilities

### Modified Capabilities

- `box-player`: the two address code requirements ("as each item starts" and "while a single item plays") are replaced by one: "Keeps its address on the TV while something plays".

## Impact

- **Code:** `scheduler/player.js` (`followCode`), `scheduler/config.js`.
- **Rehearsal:** `inside.sh`'s "taken away 3 to 4 seconds later" becomes "still up across items".
- **Tests and docs:** `player.test.js`, the README and the schedule skill.
