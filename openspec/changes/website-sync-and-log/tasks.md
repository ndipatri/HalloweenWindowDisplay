# Tasks

## 1. Tests first

- [x] 1.1 Add to `scheduler/tests/website.test.js` one test per new override-website scenario, named exactly as the scenario, with fake `startSync` and `readTail`; add the lock scenario's test to `scheduler/tests/sync.test.js`, holding `.sync.lock` with `flock` from a test process
- [x] 1.2 Run them and verify all six fail on assertions while the existing tests still pass; verify `node openspec/check-scenarios.js website-sync-and-log` finds every scenario's test

## 2. The website

- [x] 2.1 `website.js`: `POST /api/sync` (through `startSync`) and `GET /api/log` (the last 20 non-empty lines through `readTail`, dropping a first line cut off by the 16 KB read); the page's Sync now button and Recent activity list; `syncStarter` in `startWebsite` (spawns the sync with output appended to the log, clears its mark on exit, logs a failure to start). Verify the website tests pass.
- [x] 2.2 `player.js`: `realIo.readTail` reads only the end of the file
- [x] 2.3 Drive the page in Chromium at phone size against the real website and a stand-in sync. The first try showed the page's script dead: a `'\n'` inside the page's JavaScript string became a real line break in the served page. The tests only checked the page's text, so they couldn't see it. Fixed, and both page tests now also check that the page's script compiles, which catches it (with the bug put back, both page tests fail). Verify in the browser:
  - 20 log lines shown;
  - Sync now answers, and pressing it again says a sync is already running;
  - the sync's lines appear in the list;
  - no console errors.
- [x] 2.4 Move the message line under the status, so every reply shows where you look, including Sync now's

## 3. One sync at a time

- [x] 3.1 `sync_videos.sh`: hold `flock -n` on `~/video-scheduler/.sync.lock` (file descriptor 9) for the whole run, and log `Skipped: another sync is already running.` and exit 0 when it's held; fix the help text's line range; verify the sync tests pass

## 4. Docs

- [x] 4.1 README (Sync now, Recent activity, everyday tasks, a new video doesn't play) and the schedule skill (the API, Sync now, the lock)

## 5. Verification

- [x] 5.1 Run every Node test file and verify they pass (13 player, 26 scheduler, 5 spec, 14 sync, 18 website)
- [x] 5.2 Run `node openspec/check-scenarios.js website-sync-and-log` and verify every scenario has its test
- [x] 5.3 Disable check: break each new behaviour in a copy and verify its test fails:
  - the sync never started;
  - a running sync ignored;
  - the whole log shown;
  - a missing log breaking the page;
  - the page without Sync now;
  - the page never loading the log;
  - no lock;
  - the page script's line break put back.

  Each failed its test.
- [x] 5.4 Add the scenario-to-test table below
- [x] 5.5 The change touches `website.js`, `player.js` and `sync_videos.sh`, which the rehearsal runs. Add three checks to `inside.sh`:
  - "Sync now starts a sync that finishes in the log";
  - "the website shows the log's last lines";
  - "a second sync while one runs is skipped".

  Run it on the final code, and verify `31 passed, 0 failed`.
- [x] 5.6 Run `openspec validate website-sync-and-log --strict` and verify it is valid

| Scenario (= test name) | Test file | Fails when |
|---|---|---|
| the website starts a sync when asked | `scheduler/tests/website.test.js` | the sync never started |
| the website doesn't start a second sync while one is running | `scheduler/tests/website.test.js` | a running sync ignored |
| the website shows the last lines of the log | `scheduler/tests/website.test.js` | the whole log shown |
| the website shows no log lines when there is no log yet | `scheduler/tests/website.test.js` | a missing log breaks it |
| the website page offers Sync now and shows recent activity | `scheduler/tests/website.test.js` | the page without Sync now; the page never loads the log; the page's script broken |
| a sync that starts while another is running skips | `scheduler/tests/sync.test.js` | no lock |

## Workflow follow-up

- **Archive order:** replace-mac-with-pi-box, then add-sync-specs, then this change. It adds to `override-website` and `video-sync`, which those two create.
- On the box, after merging: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Then check that the page has Sync now and Recent activity, and that Sync now adds `sync:` lines within a minute.
