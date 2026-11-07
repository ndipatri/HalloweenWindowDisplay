# Proposal

## Why

Tapping My picks with nothing picked turned the window black, with the reason only in the log. In the emulator the picks start empty after every restart, so it happened at once and looked like a fault.

## What Changes

- The website refuses to start My picks while nothing on the box is picked: `Nothing is picked yet. Tick something under My picks first.`
- No override is written, so the window stays on what it was showing.
- The answer appears where the person tapped:
  - under the Play card for the My picks button;
  - in the note under the list for Play my picks, which is already greyed out with nothing picked.
- Unchanged: unticking everything while My picks plays still shows black and logs `Nothing picked yet…` once. Picks that are all gone from the box count as nothing picked.

## Capabilities

### New Capabilities

### Modified Capabilities
- `my-picks`: My picks can't be started with nothing picked.

## Impact

- `scheduler/website.js`: `show()` only.
- `scheduler/tests/website.test.js`: one new scenario.
- On the box: rerun setup (code under `scheduler/` changed).

## Product decisions

From the person: refuse My picks, and say why, while nothing is picked.

## Assumed product decisions

Mine; change them if you like.
- The wording, as above.
- The My picks button under Play stays tappable, rather than greyed out, so tapping it says why.
