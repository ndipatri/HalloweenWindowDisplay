## Context

See proposal.md - Why. The scheduler's 26 tests in `scheduler/tests/scheduler.test.js` already check its behaviour, and this change writes the matching specs without touching the code or the tests.

## Goals / Non-Goals

**Goals:**
- One scenario per existing test, named exactly as the test, grouped into four capabilities.
- Once archived, `scheduler/tests/specs.test.js` enforces all 26 on every test run.

**Non-Goals:**
- Splitting tests that check several days or states at once (see proposal.md - Assumed product decisions).
- Specs for `sync`, `show`, `start` and `install.sh`, which have no tests yet.

## Decisions

- **Four capabilities (seasons, daily-schedule, overrides, playlists)**, following the test file's sections. Overrides have their own capability because they are a separate thing the person does (`show`), and the schedule rules apply without them. Rejected: one `scheduler` capability, which would be a catch-all.
- **Scenarios describe what the tests assert, in concrete dates and status text**, so a reader can check a scenario against its test line by line.
- **The disable check is done by breaking code, not by reverting it.** This change adds no code, so for each capability one scheduler function at a time is replaced with a wrong version in a throwaway copy, and the tests are rerun. Every test fails under at least one break (see tasks.md).

Each scenario's test reaches the behaviour through the functions the test loader already exposes (`activeSeason`, `parseDay`, `validSeasons`, `validSchedule`, `resolve`, `foldersFor`, `whatToShow`, `parseOverride`, `createPlaylist`, `keepPlaying`).

## Risks / Trade-offs

- [Scenarios with several AND clauses are harder to read than one-state scenarios] → They mirror today's tests exactly; split them in a later change if a test is split.
- [A test renamed later silently breaks its link] → `specs.test.js` fails as soon as a scenario has no test of its name.

## Getting it onto the Mac

Nothing to install: this change adds only specs and no scheduler code. A `git pull` on the Mac brings the specs along with the rest of the repo.
