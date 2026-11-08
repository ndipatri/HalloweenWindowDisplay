# Tasks

## 1. Tests first (one per new or reworded scenario, named exactly as the scenario)

- [x] 1.1 In `scheduler/tests/scheduler.test.js`, through `load()` with fake folders and fake `filters.json`, `tags.json` and `override.json`, add the `tags` scenarios that `items()` reaches:
  - `a video's tag is its folder path joined with dashes`;
  - `a photo in a repo folder is not an item`;
  - `a folder whose name makes no tag is left out and logged once`;
  - `an upload is tagged upload`.

  Add `items`, `readFilters`, `filterItems`, `scheduledFilter` and `checkFilter` to what the test loader uses, guarding each so a missing function fails as an assertion. Verify each test fails on an assertion.
- [x] 1.2 In the same file, add the `filters` scenarios:
  - `a filter plays the items with any of its tags`;
  - `a filter leaves out items with an except tag`;
  - `a box tag puts any item in a filter`;
  - `a filter plays its items in name order, round and round`;
  - `a filter with nothing in it shows black and says so once`;
  - `a bad filter in the filters file is skipped and logged`;
  - `no filters file means no filters`;
  - `the starting filters are today's seasons, favorites and uploads` (reading the real `scheduler/filters.default.json`).

  Verify each fails on an assertion.
- [x] 1.3 In the same file, add every `filter-schedule` scenario and the `overrides` scenarios:
  - `a scheduled filter plays on its days and times`;
  - `the next filter takes over when its time starts`;
  - `outside every entry the screen is black`;
  - `schedule days are inclusive and can wrap the new year`;
  - `days written as the nth or last weekday of a month, with offsets` (rewritten for `also` days);
  - `weekdays within the range, and extra days outside it or with a year`;
  - `Thanksgiving: Fridays and Saturdays until Thanksgiving, then the day before and the day` (rewritten for the starting Thanksgiving filter);
  - `a time that crosses midnight belongs to the day it starts`;
  - `where two filters' entries overlap, the higher one plays`;
  - `an override "until the schedule changes" ends at the next period` (rewritten);
  - `an override plays the chosen filter whatever its schedule`;
  - `an override for a filter that's gone is ended and logged`;
  - `override file validation for filters`.

  Keep the old tests of the same names alongside as `_old` copies only if needed to keep the file running. Verify each new test fails on an assertion.
- [x] 1.4 In `scheduler/tests/player.test.js`, add or rewrite the `box-player` scenarios with fake `filters.json`:
  - `the box plays the scheduled filter`;
  - `the box switches filters when the schedule changes`;
  - `a filter that comes back resumes at the item it was on`;
  - `an item added while playing is queued without a restart`;
  - `the box keeps the next items queued`;
  - `the box shows black when nothing is scheduled`;
  - `the box shows black while an override chooses black`;
  - `the box stays black until the clock is set`;
  - `the box starts playing once the clock is set`;
  - `the box writes what it is showing to the status file and the log`;
  - `the box skips an item mpv can't play and logs it once`.

  Add the `filters` scenarios `tagging an item while its filter plays queues it in its place` and `untagging the item on screen moves on to the next item` (calling `player.refilter()`). Rewrite `removing the upload on screen moves on to the next` and `removing a queued upload takes it out of the queue` for All uploads. Verify each fails on an assertion.
- [x] 1.5 In `scheduler/tests/website.test.js`, through `handle` with `site()` (given fake `filters.json`/`tags.json`) and `uploads()`, add the `tags` website scenarios:
  - `the website adds a box tag to an item`;
  - `the website removes a box tag from an item`;
  - `a box tag can repeat a folder tag`;
  - `the website refuses a tag name it can't use`;
  - `a folder tag can't be removed`;
  - `the website refuses to tag something that isn't an item`;
  - `the website lists the items and their tags`;
  - `box tags of an item no longer on the box are left out`;
  - `removing an upload drops its box tags`;
  - `the box turns the old picks into favorites`.

  Verify each fails on an assertion.
- [x] 1.6 In the same file, add the `filters` website scenarios:
  - `the website lists the filters`;
  - `the website saves the filters with the right PIN`;
  - `the website refuses to save filters with the wrong PIN`;
  - `the website refuses to save filters while no PIN is set`;
  - `the website refuses a filter it can't use`.

  Add the `override-website` scenarios, rewriting those whose names carry over:
  - `the website shows what is on screen now`;
  - `the website says when the box has not started yet`;
  - `the website shows a filter until the schedule changes`;
  - `the website shows a filter for a number of minutes`;
  - `the website shows a filter until switched back`;
  - `the website turns the screen black`;
  - `the website goes back to the schedule`;
  - `the website refuses a filter it doesn't have`;
  - `the website refuses a filter with nothing in it`;
  - `the website refuses minutes that aren't a whole number above zero`;
  - `the website lists its filters as choices`;
  - `the website page offers each choice`;
  - `the page offers each filter as a Play button`;
  - `the page shows the status under Play and outlines what is playing`;
  - `the page works out which filter is playing from the status` (`playingFilter` in `vm`);
  - `the website page offers tagging items`;
  - `the website page offers editing filters with the PIN`;
  - `the page moves a filter up and down` (`moveFilter` in `vm`).

  Verify each fails on an assertion.
- [x] 1.7 In `scheduler/tests/setup.test.js`, add `setup copies the starting filters to a box that has none` and `setup keeps a box's own filters`. Verify each fails on an assertion.
- [x] 1.8 Run every test file. Confirm the new and rewritten tests fail, each on an assertion. Run `node openspec/check-scenarios.js tags-and-filters` and confirm it reports no missing tests.

## 2. Tags and filters in the scheduler (logic)

- [x] 2.1 Add `scheduler/filters.default.json` (the starting set from the specs) and remove `seasons` and `schedule` from `scheduler/config.js`, pointing its comment to the website's Filters. Verify the starting-filters test passes.
- [x] 2.2 In `scheduler/logic.js`, add the tag functions and expose them:
  - `tagFromFolder`, `isTagName`;
  - `items()` (folders to depth two, uploads, `tags.json`, folders that make no tag logged once);
  - `filterItems(filter)`.

  Verify the 1.1 tests and the matching tests from 1.2 pass.
- [x] 2.3 In `scheduler/logic.js`, add `checkFilter`, and `readFilters()`, cached by the file's text and logging once. Add `scheduledFilter`, reusing `parseDay`, `parseWeekdays`, `isTime` and the guarded range check. Rewrite `nextScheduleChange`, `whatToShow`, `parseOverride` and `currentOverride` for filters:
  - the new status wording;
  - an override for a gone filter is ended;
  - an old-format override is removed.

  Remove `resolve`, `foldersFor`, `validSeasons`, `validSchedule`, `activeSeason`, the `PHOTOS`/`PICKS` kept-name code and picks. Verify the 1.2 and 1.3 tests pass.
- [x] 2.4 In `keepPlaying`/`createPlaylist`, take a playlist's items from `filterItems`, and remove the `photos` and `ordered` branches. Name the filter in `playing …`, `Skipping …` and the nothing-to-show line. Verify the 1.2 play tests pass.

## 3. The player

- [x] 3.1 In `scheduler/player.js`:
  - read filters each tick via `logic.readFilters()`, and log `Filters: …` at start;
  - turn `repick` into `refilter` (steps 1–6 in design.md), passed to the website as `filtersChanged`;
  - remove the `Seasons:` line.

  Verify the 1.4 tests pass and every other player test still passes.

## 4. The website

- [x] 4.1 In `scheduler/website.js`, add the routes:
  - `GET /api/items`, `POST /api/tags`;
  - `GET /api/filters`, `POST /api/filters` (with PIN, the no-PIN wording, and the larger body cap with its message);
  - `GET /api/choices` as filters;
  - `POST /api/show` for filters (refusing unknown and empty ones);
  - `GET /api/status` without `season`.

  Also: the move-over from `picks.json` at start; dropping box tags and calling `filtersChanged` on upload removal; removing `/api/picks` and the season and picks code. Verify the 1.5 and 1.6 API tests pass.
- [x] 4.2 On the page:
  - **Play:** filter buttons from `/api/choices` and Black, outlined with `playingFilter`.
  - **Tags section:** chips, ×, ☆/★ and add-tag with a datalist, each change noted on its row.
  - **Filters section:** list with ↑↓ (`moveFilter`), edit, delete and new; an editor for the name, any of/except and entries; save with the PIN, showing the answer.
  - **Removed:** the Seasons row, the fixed buttons, the My picks section, `togglePick` and `playingChoices`.

  Verify the 1.6 page tests pass and the page script compiles (no backticks or `${` in the page).
- [x] 4.3 Start `startWebsite` alone on a spare port with a temporary video folder and the starting filters. With `curl`, list items, tag and untag, save filters with and without the PIN, and show a filter.

## 5. Setup, docs and moving the specs

- [x] 5.1 In `scheduler/setup.sh`, copy `filters.default.json` to `$videos/filters.json` when there is none, before `owned "$videos"`, and print `Added the starting filters (…).`. Verify the 1.7 tests pass and the existing setup tests still pass.
- [x] 5.2 Update the rehearsal's `scheduler/tests/e2e/inside.sh` as design.md's Rehearsal section says:
  - setup's filters file and its owner;
  - `Filters:` lines;
  - Halloween grownup and All uploads instead of playlists;
  - favorites instead of My picks;
  - saving a filter with the PIN.
- [x] 5.3 Rewrite the window-display-schedule skill:
  - how filters, tags and schedules work, and where they live;
  - adding a season = a folder in `playlists/` plus a filter on the website, and in `filters.default.json` for new boxes;
  - the API and the files.

  Update the window-display-video skill's "how to see it" (the filter's Play button). Update the README in plain words: "What's playing" (the starting filters, set on the website), "Using it" (Play buttons, tagging, favorites, filters with the PIN), and "If something's wrong".
- [x] 5.4 Try it in the emulator (`bash scheduler/tests/e2e/emulate.sh`) on a phone-sized screen:
  - the Play buttons;
  - favorite two items and play Favorites;
  - add a tag to an upload;
  - edit Thanksgiving's times with the PIN, then move a filter up.

## 6. Verification

- [x] 6.1 Run every test file (on Linux, in the `tvbox-node-tests` image, for sync and cards) and `node --check` on every changed `.js` file. Confirm all pass, except `specs.test.js` on the retired scenario names until 6.6.
- [x] 6.2 Run `node openspec/check-scenarios.js tags-and-filters` and confirm every scenario has its test.
- [x] 6.3 Disable check: temporarily revert the changed code (not the tests), rerun only the tests this change added or rewrote, confirm each fails, then restore the code. List and fix any test that passes either way.
- [x] 6.4 Add a table to this file mapping each scenario to its test file, listing a scenario only after its test passed the disable check.
- [x] 6.5 Run `bash scheduler/tests/e2e/box.e2e.sh` (or its `docker run` with the cached image, if Docker Hub can't be reached), confirm every check passes, and record the result line.
- [x] 6.6 Run `openspec validate tags-and-filters --strict`, then archive the change. Delete the five emptied spec folders (`seasons`, `daily-schedule`, `playlists`, `my-picks`, `photos-playback`) and the retired scenarios' tests. Confirm `specs.test.js` and `node openspec/check-scenarios.js` pass.
- [x] 6.7 Implementation review: run `review-orchestrator` on the whole change against `origin/main` (code, tests, `inside.sh`, the page, README, skills, OpenSpec), telling its reviewers this is Node (built-in modules only), bash, mpv and systemd on a Raspberry Pi, with the schema's test-per-scenario rule. Fix every BLOCKING finding, rerun every test file (and the rehearsal if a fix touched what it runs), and repeat until none remain. Record each round here. Round 1: no BLOCKING findings. Warnings fixed:
  - an override "until the schedule changes" now looks a year ahead, checking only the minutes where a window starts or stops and midnight;
  - extra days with an offset across a year (`01-01-1`) match;
  - whether a range wraps the new year is decided from its months as written, so `11-4thu` ranges can't flip;
  - the picks migration only removes `picks.json` after saving, and logs instead of failing;
  - bad entries in `tags.json` are skipped;
  - `off` is reserved like `black`, and the website no longer treats `off` as black;
  - an override for a missing filter isn't ended while `filters.json` has mistakes;
  - on the page, a refused filter PIN stays in the Filters section, typed tags survive a redraw, and each answer goes to the row as it is now;
  - `refilter` uses the latest read of mpv's playlist and merges rebuilds that are waiting;
  - tests added for each, plus the tag change telling the player;
  - stale comments and docs in `config.js`, the video skill, the archived design and a "MAY" in the tags spec;
  - dead CSS and code removed.

  Accepted: the 413 body cap is covered only by the hand check with `curl`, and `FakeMpv` doesn't move on between reads (the refilter race is guarded in code, not in a test). Every test file and the rehearsal were rerun after the fixes.

### Results

- 6.1: every test file passes on Linux (`tvbox-node-tests`): cards 16, player 22, scheduler 25, setup 7, sync 15, website 75; `specs.test.js` passes after 6.6.
- 6.3: with `logic.js`, `player.js`, `website.js`, `config.js` and `setup.sh` reverted (the tests and `filters.default.json` kept), 65 of the 74 new or rewritten tests failed. Of the nine that passed:
  - four player tests (`the box plays the scheduled filter`, `the box switches filters when the schedule changes`, `the box keeps the next items queued`, `an item added while playing is queued without a restart`) passed only because the old Halloween kid playlist plays the same files. They now also check the filter's name in the log or status, and fail with the old code.
  - `setup keeps a box's own filters` passes either way by nature: the old setup never wrote `filters.json`. Its partner `setup copies the starting filters to a box that has none` fails with the old setup.
  - `the website shows what is on screen now`, `the website turns the screen black`, `the website goes back to the schedule` and `the website refuses minutes that aren't a whole number above zero` are reworded scenarios of behaviour this change keeps on purpose, so they pass either way.
- 6.5: the rehearsal (cached `tvbox-e2e` image) printed `65 passed, 0 failed`.
- 5.4: tried in the emulator on a phone-sized screen:
  - the Play buttons are the five starting filters and Black, with Thanksgiving outlined on a Saturday evening;
  - starring two items and playing Favorites works, and the status reads `Favorites (override until cleared)`;
  - adding the tag `scary` to a video works;
  - editing Thanksgiving to 16:00-23:00 and moving Favorites up, then saving with the PIN, gives `✓ Saved 5 filters.`, and the Play buttons follow the new order;
  - a filter called Black is refused with `Black: black is kept for the Black button.`;
  - Back to schedule returns to `Thanksgiving (scheduled until 11:00 PM)`.

  Two fixes came out of trying it: each tag row's confirmation is kept when the list redraws, and the editor's entries are headed "Days and times".

| Capability | Scenario | Test file |
|---|---|---|
| box-player | the box stays black until the clock is set | player.test.js |
| box-player | the box starts playing once the clock is set | player.test.js |
| box-player | the box plays the scheduled filter | player.test.js |
| box-player | the box switches filters when the schedule changes | player.test.js |
| box-player | a filter that comes back resumes at the item it was on | player.test.js |
| box-player | an item added while playing is queued without a restart | player.test.js |
| box-player | the box keeps the next items queued | player.test.js |
| box-player | the box shows black when nothing is scheduled | player.test.js |
| box-player | the box shows black while an override chooses black | player.test.js |
| box-player | the box writes what it is showing to the status file and the log | player.test.js |
| box-player | the box skips an item mpv can't play and logs it once | player.test.js |
| filter-schedule | a scheduled filter plays on its days and times | scheduler.test.js |
| filter-schedule | the next filter takes over when its time starts | scheduler.test.js |
| filter-schedule | outside every entry the screen is black | scheduler.test.js |
| filter-schedule | schedule days are inclusive and can wrap the new year | scheduler.test.js |
| filter-schedule | days written as the nth or last weekday of a month, with offsets | scheduler.test.js |
| filter-schedule | weekdays within the range, and extra days outside it or with a year | scheduler.test.js |
| filter-schedule | Thanksgiving: Fridays and Saturdays until Thanksgiving, then the day before and the day | scheduler.test.js |
| filter-schedule | a time that crosses midnight belongs to the day it starts | scheduler.test.js |
| filter-schedule | where two filters' entries overlap, the higher one plays | scheduler.test.js |
| filters | a filter plays the items with any of its tags | scheduler.test.js |
| filters | a filter leaves out items with an except tag | scheduler.test.js |
| filters | a box tag puts any item in a filter | scheduler.test.js |
| filters | a filter plays its items in name order, round and round | scheduler.test.js |
| filters | a filter with nothing in it shows black and says so once | scheduler.test.js |
| filters | tagging an item while its filter plays queues it in its place | player.test.js |
| filters | untagging the item on screen moves on to the next item | player.test.js |
| filters | removing the upload on screen moves on to the next | player.test.js |
| filters | removing a queued upload takes it out of the queue | player.test.js |
| filters | the website lists the filters | website.test.js |
| filters | the website saves the filters with the right PIN | website.test.js |
| filters | the website refuses to save filters with the wrong PIN | website.test.js |
| filters | the website refuses to save filters while no PIN is set | website.test.js |
| filters | the website refuses a filter it can't use | website.test.js |
| filters | a bad filter in the filters file is skipped and logged | scheduler.test.js |
| filters | no filters file means no filters | scheduler.test.js |
| filters | setup copies the starting filters to a box that has none | setup.test.js |
| filters | setup keeps a box's own filters | setup.test.js |
| filters | the starting filters are today's seasons, favorites and uploads | scheduler.test.js |
| override-website | the website goes back to the schedule | website.test.js |
| override-website | the website shows what is on screen now | website.test.js |
| override-website | the website says when the box has not started yet | website.test.js |
| override-website | the website shows a filter until the schedule changes | website.test.js |
| override-website | the website shows a filter for a number of minutes | website.test.js |
| override-website | the website shows a filter until switched back | website.test.js |
| override-website | the website turns the screen black | website.test.js |
| override-website | the website refuses a filter it doesn't have | website.test.js |
| override-website | the website refuses a filter with nothing in it | website.test.js |
| override-website | the website refuses minutes that aren't a whole number above zero | website.test.js |
| override-website | the website lists its filters as choices | website.test.js |
| override-website | the website page offers each choice | website.test.js |
| override-website | the page offers each filter as a Play button | website.test.js |
| override-website | the page shows the status under Play and outlines what is playing | website.test.js |
| override-website | the page works out which filter is playing from the status | website.test.js |
| override-website | the website page offers tagging items | website.test.js |
| override-website | the website page offers editing filters with the PIN | website.test.js |
| override-website | the page moves a filter up and down | website.test.js |
| overrides | an override "until the schedule changes" ends at the next period | scheduler.test.js |
| overrides | an override plays the chosen filter whatever its schedule | scheduler.test.js |
| overrides | an override for a filter that's gone is ended and logged | scheduler.test.js |
| overrides | override file validation for filters | scheduler.test.js |
| tags | a video's tag is its folder path joined with dashes | scheduler.test.js |
| tags | a photo in a repo folder is not an item | scheduler.test.js |
| tags | a folder whose name makes no tag is left out and logged once | scheduler.test.js |
| tags | an upload is tagged upload | scheduler.test.js |
| tags | the website adds a box tag to an item | website.test.js |
| tags | the website removes a box tag from an item | website.test.js |
| tags | a box tag can repeat a folder tag | website.test.js |
| tags | the website refuses a tag name it can't use | website.test.js |
| tags | a folder tag can't be removed | website.test.js |
| tags | the website refuses to tag something that isn't an item | website.test.js |
| tags | the website lists the items and their tags | website.test.js |
| tags | box tags of an item no longer on the box are left out | website.test.js |
| tags | removing an upload drops its box tags | website.test.js |
| tags | the box turns the old picks into favorites | website.test.js |

## Workflow follow-up

- Open one PR with `gh api` (as the window-display-schedule skill says); merge only when asked.
- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Then check:
  - the Play buttons read Halloween kid, Halloween grownup, Thanksgiving, Favorites, All uploads and Black;
  - on a Thanksgiving evening the status reads `Thanksgiving (scheduled until 11:00 PM)`;
  - the upload already on the box is under Tags with `upload`;
  - `tail ~/video-scheduler/scheduler.log` shows `Filters: …`.
- Box-only: the Tags and Filters sections are comfortable on the person's phone, and editing a schedule there feels manageable.
- Box-only: filters and box tags live only on this box and aren't backed up. A new card starts from the starting filters.
