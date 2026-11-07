# Proposal

## Why

The page shows what is on the window in a card at the top, and the choices in a separate Play section below it. The two say the same thing in two places, and nothing among the Play buttons shows which one is on.

## What Changes

- The status line moves into the Play section, just above the buttons, as "Now:" followed by the status.
- The Play button for what is on the window is outlined, and marked as current for screen readers:
  - **Kid** or **Grownup** while that playlist plays, scheduled or chosen (in any season);
  - **My picks** for `picks`, **All uploads** for `photos`;
  - **Black** whenever the window is black (chosen, outside the schedule, no season today, or waiting for the clock).
  - No button is outlined while a whole season is previewed (e.g. `thanksgiving`), as no button plays that.
- The outline follows the status as it changes, every few seconds, like the status line.

## Capabilities

### New Capabilities

### Modified Capabilities
- `override-website`: the page shows the status inside the Play section and outlines the button for what is playing.

## Impact

- `scheduler/website.js`: the page only. No change to the API, the player or the log.
- `scheduler/tests/website.test.js`: the two new page scenarios.
- On the box: rerun setup (code under `scheduler/` changed).

## Product decisions

From the person: combine the status and the Play section, and outline the button that is selected.

## Assumed product decisions

Mine; change any of them.
- "Now:" before the status line, which stays in the box's own words.
- Black is outlined for any black, not just one chosen with the Black button.
- A season/playlist preview (e.g. `halloween/grownup`) outlines that playlist's button, Grownup, since it plays a grownup playlist.
- Nothing is outlined for a whole-season preview.
