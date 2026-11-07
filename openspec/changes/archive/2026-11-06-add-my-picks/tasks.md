# Tasks

## 1. Tests first (one per scenario, named exactly as the scenario)

- [x] 1.1 In `scheduler/tests/scheduler.test.js`, through `load()` with fake folders and a fake `picks.json`, add `My picks plays the picks in the order they were picked, round and round`, `a single pick plays round and round`, `My picks plays on a day with no season`, `My picks with nothing picked shows black and says so once`, `My picks skips a pick that is no longer on the box and says so once`, `a season named picks is skipped and logged` and `a schedule entry for picks is skipped and logged`. Verify each fails on an assertion.
- [x] 1.2 In `scheduler/tests/website.test.js`, through `site()` with fake folders and files, add `the website lists what can be picked`, `the website leaves out a pick that is no longer on the box`, `the website saves the picks in the order given`, `the website saves each pick only once`, `the website saves an empty list of picks`, `the website refuses a pick that can't be picked` and `the website won't show a folder inside picks`. Verify each fails on an assertion (a 404 from the missing route counts).
- [x] 1.3 In the same file, rename `the website offers Photos apart from the season previews` to `the website offers All uploads and My picks apart from the season previews` (adding a `picks` folder and `picks: true`), and `the website page offers a Photos button` to `the website page offers All uploads and My picks buttons`. Add `the website page offers My picks` (the HTML) and `the page puts a ticked item at the end of the picks and closes up an unticked one` (the page script's `togglePick` in `vm`, as `batchFlow` does for `sendBatch`). Verify each fails on an assertion.
- [x] 1.4 In the same file, through `uploads()` with a real temporary folder, add `a new upload joins the end of the picks` and `removing an upload takes it out of the picks`. Verify each fails on an assertion.
- [x] 1.5 In `scheduler/tests/player.test.js`, with a player playing `picks` through `FakeMpv`, add `changing the picks while they play replaces what is queued` and `unpicking the item on screen moves on to the next pick`: rewrite the fake `picks.json`, then call `player.repick()`. Verify each fails on an assertion (a missing `repick` is guarded so it fails as one).
- [x] 1.6 Run every test file and confirm only the new tests fail, each on an assertion. Run `node openspec/check-scenarios.js add-my-picks` and confirm it reports no missing tests.

## 2. Picks in the scheduler (logic, player)

- [x] 2.1 In `scheduler/logic.js`, add the kept name `PICKS`: `resolve` returns it as it is; `seasonError` and `validSchedule` reject it with their reasons. Verify the two kept-name tests pass and every existing scheduler test still passes.
- [x] 2.2 In `scheduler/logic.js`, add `PICKS_PATH`, `readPicks()`, `pickable(path)` and `pickableItems()` (design.md), and expose them. Make `createPlaylist('picks')` an ordered playlist, and in `keepPlaying` take its items from the picks, skipping and logging missing ones once, logging `NO_PICKS` once when there are none, and choosing the next item and `resumeAt` by position. Keep `playlist.order`. Verify the 1.1 tests pass, and every existing scheduler test still passes.
- [x] 2.3 In `scheduler/player.js`, add `repick()`, run through `serially`, as design.md describes, and pass it to `startWebsite` as `picksChanged` in `main`. Verify the 1.5 tests pass and every existing player test still passes.

## 3. My picks on the website

- [x] 3.1 In `scheduler/website.js`, add `GET /api/picks` and `POST /api/picks` with the wording from the specs; leave `picks` out of the previews; add `picks: true` to the choices; refuse `picks/…` in `show()`; append a new upload to the picks and take a removed one out, calling `picksChanged` (absent is a no-op). Verify the 1.2 and 1.4 tests and the choices test pass.
- [x] 3.2 On the page: the My picks and All uploads buttons in the Play grid, the My picks section with groups, tick boxes and numbers, `togglePick`, saving on every change, and reloading the list after uploads and removals. Verify the 1.3 tests pass and the page script compiles. Also order the Play grid Kid, Grownup, My picks, All uploads, Black. Then start `startWebsite` alone on a spare port with a temporary `videoRoot`, and with `curl` list, save and refuse picks.
- [x] 3.3 Update the window-display-schedule skill (Playback: the picks playlist and its order; Files: `picks.json`; the kept name `picks`; the website's My picks and All uploads) and the README's "Using it" in plain words (My picks: tick what you want, tap My picks; All uploads). Verify neither still calls the button Photos.

## 4. Verification

- [x] 4.1 Run every test file (`for f in scheduler/tests/*.test.js; do node "$f" || exit 1; done`) and `node --check` on every changed `.js` file, and confirm they pass.
- [x] 4.2 Run `node openspec/check-scenarios.js add-my-picks` and confirm every scenario has its test.
- [x] 4.3 Disable check: temporarily revert the changed code (not the tests), rerun only the tests this change added or changed, confirm each fails, then restore the code. List any test that passes either way, with the reason, and fix it.
- [x] 4.4 Add a table to this file mapping each scenario to its test file, listing a scenario only after its test passed the disable check.
- [x] 4.5 Add the My picks check to `scheduler/tests/e2e/inside.sh` (save two clips with `POST /api/picks`, show `picks` until cleared, wait for the status `picks (override until cleared)` and `picks: playing <first clip>` in the log), run `bash scheduler/tests/e2e/box.e2e.sh`, and confirm every check passes. Record the result line. Result: `62 passed, 0 failed` (run from the cached `tvbox-e2e` image with `box.e2e.sh`'s own `docker run`, as Docker Desktop could not reach Docker Hub to rebuild it; the Dockerfile is unchanged since that image was built).
- [x] 4.6 Run `openspec validate add-my-picks --strict` and fix what it reports.
- [x] 4.7 Implementation review: run the `review-orchestrator` skill on the whole change against `origin/main` (code, tests, `inside.sh`, the page, README, skill, OpenSpec artifacts), telling its reviewers this is Node (built-in modules only), bash, mpv and systemd on a Raspberry Pi with this schema's test-per-scenario rule. Fix every BLOCKING finding, rerun every test file (and the rehearsal if a fix touched what it runs), and repeat until none remain. Record each round here. Round 1: no BLOCKING findings; nine warnings, seven fixed and two accepted (see design.md's Design review); the extra tests are in `website.test.js` and `player.test.js`; every test file and the rehearsal were rerun after the fixes.

### Results

- 4.1: on the Mac, `scheduler`, `website`, `player` and `setup` pass; `sync` and `cards` need `flock` and PyYAML, which the Mac lacks, so all test files were also run in the Linux `tvbox-node-tests` image: all pass (cards 16, player 19, scheduler 42, setup 5, sync 15, website 67). `specs.test.js` passes once this change is archived (the main specs still name the two Photos tests it renames).
- 4.1 also found `a phone dropping off mid-upload is not logged as an error` failing on main under Node 22: newer Node passes the phone's read error on to the file stream, which the website took for a write failure. Fixed in `receiveUpload` (the source's own error is ignored on the file stream).
- 4.3: with `logic.js`, `player.js` and `website.js` reverted to `origin/main`, all 22 tests below fail (and the mid-upload test above); none passes either way.

| Scenario | Test file |
|---|---|
| the website lists what can be picked | website.test.js |
| the website leaves out a pick that is no longer on the box | website.test.js |
| the website saves the picks in the order given | website.test.js |
| the website saves each pick only once | website.test.js |
| the website saves an empty list of picks | website.test.js |
| the website refuses a pick that can't be picked | website.test.js |
| the website won't show a folder inside picks | website.test.js |
| My picks plays the picks in the order they were picked, round and round | scheduler.test.js |
| a single pick plays round and round | scheduler.test.js |
| My picks plays on a day with no season | scheduler.test.js |
| My picks with nothing picked shows black and says so once | scheduler.test.js |
| My picks skips a pick that is no longer on the box and says so once | scheduler.test.js |
| changing the picks while they play replaces what is queued | player.test.js |
| unpicking the item on screen moves on to the next pick | player.test.js |
| the website page offers My picks | website.test.js |
| the page puts a ticked item at the end of the picks and closes up an unticked one | website.test.js |
| the website offers All uploads and My picks apart from the season previews | website.test.js |
| the website page offers All uploads and My picks buttons | website.test.js |
| a new upload joins the end of the picks | website.test.js |
| removing an upload takes it out of the picks | website.test.js |
| a season named picks is skipped and logged | scheduler.test.js |
| a schedule entry for picks is skipped and logged | scheduler.test.js |

## Workflow follow-up

- Open the PR with `gh api` (as the window-display-schedule skill says); merge only when asked. The change is archived in the same PR, so `specs.test.js` checks the renamed scenarios.
- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Then on `http://tvbox.local/` check the Play buttons (Kid, Grownup, My picks, All uploads, Black), tick two items in My picks, tap My picks, and check the status `picks (override …)` and `My picks: 2 picked (from the website).` and `picks: playing …` in `~/video-scheduler/scheduler.log`.
- Box-only: the My picks list is comfortable to use on the person's phone, and a picked photo shows for 10 seconds on the TV.
