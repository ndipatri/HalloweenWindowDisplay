## Why

The scheduler already has 26 tests, but no specs say what it promises. Writing those promises down as specs, with each scenario named after the test that checks it, means the current behaviour is enforced from now on: `scheduler/tests/specs.test.js` fails if any archived scenario loses its test.

## What Changes

- Add specs for what the scheduler does today, with no change to its code or tests.
- Each scenario has exactly the name of the existing test that checks it, so all 26 tests become the enforcement of a scenario.
- The sync, `show`, `start` and installer scripts have no tests yet, so they get no specs in this change.

## Capabilities

### New Capabilities
- `seasons`: which season, if any, is active on a given day, and how season entries are written and checked.
- `daily-schedule`: when the screen is on each day, which playlist the schedule picks, and the status it reports.
- `overrides`: how a manual override (from `show`) changes what plays, and how override files are checked.
- `playlists`: which folders a playlist plays and the order its videos play in, including missing or empty folders.

### Modified Capabilities
- None.

## Impact

- New files under `openspec/specs/` once this change is archived. No code, test, README or Mac changes.

## Assumed product decisions

- Each scenario mirrors one existing test, including the tests that check several days or states at once. The schema prefers one state per scenario. Splitting those tests (and their scenarios) is left to a later change, so this one changes no tests. Rejected: splitting the tests now.
- The shell scripts are left out until they have tests. Rejected: specs for them now, which nothing would enforce.
