# Proposal

## Why

The person finds the Play my picks button under the My picks list redundant: the My picks button under Play does the same.

## What Changes

- The **Play my picks** button under the list is removed.
- The note under the list stays, and now says what to tap: `✓ Saved. 2 picked. Tap My picks under Play to show them.`, or `Showing on the window now.` while My picks is on.
- The page code that served only that button goes (its `Starting…` label, the `▶ Playing your picks` note, and the wait for the status to catch up).
- **My picks** under Play is unchanged. With nothing picked it still says `Nothing is picked yet. Tick something under My picks first.`, under the Play card.

## Capabilities

### New Capabilities

### Modified Capabilities
- `my-picks`: the page's My picks section confirms the picks but no longer has its own play button.

## Impact

- `scheduler/website.js`: the page only.
- `scheduler/tests/website.test.js`: the page scenario renamed and changed to match.
- On the box: rerun setup (code under `scheduler/` changed).

## Product decisions

From the person: remove Play my picks, as it's redundant.
