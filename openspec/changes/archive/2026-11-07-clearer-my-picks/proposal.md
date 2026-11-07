# Proposal

## Why

Trying My picks, the person couldn't tell whether their ticks had been taken. Each tick was saved at once, but the only sign was the message line at the top of the page, out of sight of the list, and the button that plays the picks sat up under Play.

## What Changes

- The My picks section opens with one line saying what to do: tick what you'd like, they play in the order ticked, round and round, and each tick is saved straight away.
- Under the list, a bar that stays in view while the list scrolls holds:
  - a note saying `Saving…`, then `✓ Saved. 2 picked. Tap Play my picks to show them.`;
  - or, while My picks is on the window, `… Showing on the window now.`;
  - `Nothing picked yet.` with none picked;
  - on a refusal or no connection, the reason, with the ticks put back as the box has them;
  - and a **Play my picks** button, greyed out with nothing picked, that plays the picks for the chosen "For how long", like the My picks button under Play. Tapped, it reads `Starting…`, then the note says `▶ Playing your picks until 7:55 AM, then back to the schedule.` (the box's own answer).
- Every button looks pressed when tapped.
- Saving a tick no longer writes to the message line at the top.
- From trying it: the Play my picks button gave no sign of being tapped, as its answer went to the message line at the top too.

## Capabilities

### New Capabilities

### Modified Capabilities
- `my-picks`: the page explains the section, confirms each save next to the list, and offers Play my picks there.

## Impact

- `scheduler/website.js`: the page only (HTML, CSS and its script). No change to the API, the player or the log.
- `scheduler/tests/website.test.js`: the new page scenario.
- On the box: rerun setup (code under `scheduler/` changed).

## Assumed product decisions

The person reported the confusion. The wording and layout are mine; change any of them.
- The wording of the hint line and the note, as above.
- The note and button stay in view under the list, rather than at the top.
- The My picks button under Play stays too.
