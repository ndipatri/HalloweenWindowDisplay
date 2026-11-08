# Tasks

## 1. Tests first

- [x] 1.1 Move `scheduler/filters.default.json` to `playlists/filters.json`, and point the tests' starting-filters fixture there, written as `github-filters.json`.
- [x] 1.2 `scheduler/tests/scheduler.test.js`:
  - `custom filters come before the GitHub filters` (what plays, and the order `readFilters` gives, which is what `/api/choices` lists);
  - `a custom filter named like a GitHub filter is left out and logged`;
  - rewrite `no filters file means no filters` and `the GitHub filters are today's seasons, favorites and uploads`.
- [x] 1.3 `scheduler/tests/website.test.js`:
  - rewrite `the website lists the filters`;
  - add the GitHub-name case to `the website refuses a filter it can't use`;
  - check `/api/choices` lists custom filters first (in `the website lists its filters as choices`' file, as an extra test).
  - add `custom copies of the GitHub filters are dropped when the website starts`;
  - change `the website page offers editing filters with the PIN`.
- [x] 1.4 `scheduler/tests/sync.test.js`: `sync copies the GitHub filters to the box`, `sync removes the GitHub filters when the repo has none`.
- [x] 1.5 `scheduler/tests/setup.test.js`: remove the two starting-filters tests.
- [x] 1.6 Run the tests; the new and changed ones fail on an assertion.

## 2. The code

- [x] 2.1 `scheduler/logic.js`: `readFilters()` gives custom (from `filters.json`, dropping GitHub names with `ERROR: Ignoring filter N (…): GitHub has a filter called …`; bad GitHub filters log `ERROR: Ignoring GitHub filter N (…): …`) then GitHub (from `github-filters.json`). Each is marked with `source`; the cache is by both files' text; `readRawFilters()` gives `{ custom, github }`.
- [x] 2.2 `scheduler/website.js`:
  - `GET /api/filters` → `{ custom, github }`;
  - `POST /api/filters` checks custom names against GitHub's;
  - the start-up move-over drops custom copies;
  - the page lists GitHub filters read-only and edits custom ones.
- [x] 2.3 `scheduler/sync_videos.sh`: copy or remove `github-filters.json` (temp file and rename; compare first).
- [x] 2.4 `scheduler/setup.sh`: remove the starting-filters copy.

## 3. Rehearsal, docs, emulator

- [x] 3.1 `inside.sh`:
  - the first sync brings `github-filters.json` (owned by pi), and `Filters:` lists them;
  - saving a custom filter puts it first among the choices;
  - a GitHub name is refused.
- [x] 3.2 README, `playlists/README.md`, and the window-display-schedule and window-display-video skills.
- [x] 3.3 Emulator on a phone-sized screen:
  - the first sync logs `Updated the GitHub filters.`;
  - Filters shows "Yours" and a read-only "From GitHub" list;
  - a custom Sunday special (Sundays in November, 08:00-12:00) saved with the PIN plays at once and comes first among the Play buttons;
  - a custom `thanksgiving` is refused with `thanksgiving: GitHub has a filter called Thanksgiving; pick another name.`;
  - deleting the custom filter and saving leaves `black (nothing scheduled)`.

## 4. Verification

- [x] 4.1 Every test file on Linux, `node --check`, `bash -n`, `openspec validate github-filters --strict`.
- [x] 4.2 Disable check: with the old `logic.js`, `website.js`, `sync_videos.sh` and `setup.sh`, every new and changed test fails (the setup tests because the old setup copies the moved starting file).
- [x] 4.3 Rehearsal: record the result line. Result: `67 passed, 0 failed`.
- [x] 4.4 Archive; `specs.test.js` and `check-scenarios.js` pass.
- [x] 4.5 Implementation review: `review-orchestrator`; fix every BLOCKING finding. Round 1: one BLOCKING (the skill still named `filters.default.json`: fixed). Warnings fixed:
  - sync removes the GitHub copy even when the repo has no `playlists/` folder at all, and only logs the removal when it worked (tests added);
  - the website checks custom names against the usable GitHub filters, as the player does;
  - custom copies are dropped only once (marked by `.custom-copies-dropped`), so a custom filter that clashes later is skipped, never deleted (spec and test updated);
  - a name clash makes the filters "not clean", so an override isn't ended meanwhile (test added);
  - the scenario `custom filters come before the GitHub filters` now checks the website's choices in the same test;
  - stale wording in the filters spec's purpose and the skills.

  Rehearsal rerun after the fixes.

No design.md: two sources of the same filter format, read the way filters are read today.

## Workflow follow-up

- Stacked on PR #50; merge that first.
- After merging, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Then check:
  - on `http://tvbox.local/`, Filters shows the GitHub filters read-only;
  - the log shows `Updated the GitHub filters.` and, for the old copies, `Dropping the custom filter …`.
