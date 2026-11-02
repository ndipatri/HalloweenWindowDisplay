# Tasks

## 1. Tests first

- [x] 1.1 Rewrite the loader in `scheduler/tests/scheduler.test.js` to require `scheduler/logic.js` with fake `io`, and move the six playback tests from the fake AVQueuePlayer to a fake mpv, keeping every test name and what it checks; verify all 26 fail only because `logic.js` doesn't exist yet (they did: the file stopped on the missing module)
- [x] 1.2 Write `scheduler/tests/player.test.js`: one test per box-player scenario, named exactly as the scenario, with a fake mpv, clock file and folders
- [x] 1.3 Write `scheduler/tests/website.test.js`: one test per override-website scenario, named exactly as the scenario, calling `handle()` with fake files and a fixed `now`
- [x] 1.4 Run the tests and verify each new test fails on a missing module or an assertion, not a typo (with stub `player.js` and `website.js`, all 21 new tests failed on assertions); run `node openspec/check-scenarios.js replace-mac-with-pi-box` and verify no scenario is missing a test

## 2. The logic as Node modules

- [x] 2.1 Add `scheduler/config.js` with the seasons and schedule from the JXA script and the box settings; verify `node --check`
- [x] 2.2 Add `scheduler/logic.js` with the logic moved function by function, and `keepPlaying` over mpv; verify the 26 scheduler tests pass

## 3. The player

- [x] 3.1 Add `scheduler/mpv.js` (start mpv, IPC commands, properties, events) and `watchMpv`; verify the mpv exit scenario's test passes, and run the real player logic against a real mpv 0.37 (`--vo=null`) with two clips and a broken file: it played both in turn, skipped the broken one and logged it once, and the playlist property and failure events match the fake
- [x] 3.2 Add `scheduler/player.js` (`createPlayer`, `tick`, clock check, status and log, `main`); verify every box-player test passes

## 4. The website

- [x] 4.1 Add `scheduler/website.js` (`createWebsite`, `handle`, the page, `main` hook); verify every override-website test passes, and drive the served page in Chromium at phone size: status shown, Kid/Grownup/Black buttons and previews listed, an override written and cancelled

## 5. Setup and removal of the Mac code

- [x] 5.1 Add `scheduler/systemd/tvbox.service`, `tvbox-sync.service`, `tvbox-sync.timer` and `scheduler/setup.sh`; verify `bash -n scheduler/setup.sh` and that a dry run against a temporary root (`TVBOX_ROOT`, with fake `apt-get`, `systemctl`, `timedatectl` and `usermod` on `PATH`) writes the units and app files (it did, with the expected apt, usermod, timedatectl and systemctl calls), and that `systemd-analyze verify` finds nothing wrong in the units
- [x] 5.2 Remove `video_scheduler.js`, `show.sh`, `start.sh`, `install.sh` and the launchd plist; verify `grep -rn "osascript\|launchctl\|video_scheduler.js" scheduler` finds nothing
- [x] 5.3 Update the README (what the box is, using the website, if something's wrong) and both skills for the box; verify the README has no commands but the website address and the setup lines, and that the overrides spec's Purpose names the website

## 6. Verification

- [x] 6.1 Run every test file and `node --check` on each `.js` file in `scheduler/`, and verify they pass
- [x] 6.2 Run `node openspec/check-scenarios.js replace-mac-with-pi-box` and verify every scenario has its test
- [x] 6.3 Disable check: in a throwaway copy, break one thing at a time (41 breaks across the player, the mpv queue, the website and the moved logic), rerun the tests, and verify every test fails under at least one break. The first run found three gaps, all fixed:
  - A failed video's first report was logged as "Skipping a video": the queue read mpv's playlist after the failure reports, so it didn't know the file yet. Fixed by reading the playlist first. The skip test now counts every skip line, as its scenario says.
  - Removing the second "stop" when black changed nothing: it was dead code (switching already stops mpv). Removed.
  - Removing the drop of played videos changed nothing, because the play order stays right, but the queue would empty every third video and flash black. Added the requirement "Keeps the next videos queued" with its scenario and test.
- [x] 6.4 Add the scenario-to-test tables below
- [x] 6.5 Run `openspec validate replace-mac-with-pi-box --strict` and verify it is valid

New scenarios, the test that enforces each (same name), and a break that makes it fail:

| Scenario (= test name) | Test file | Fails when |
|---|---|---|
| the box plays today's season playlist on schedule | `scheduler/tests/player.test.js` | queue: one ahead |
| the box switches playlists when the schedule changes | `scheduler/tests/player.test.js` | player: no stop on switch |
| a playlist that comes back resumes at the video it was on | `scheduler/tests/player.test.js` | player: no resume |
| a video added while playing is queued without a restart | `scheduler/tests/player.test.js` | queue: folders read once |
| the box keeps the next videos queued | `scheduler/tests/player.test.js` | queue: played videos not removed |
| the box shows black outside the schedule | `scheduler/tests/player.test.js` | player: no stop on switch |
| the box stays black until the clock is set | `scheduler/tests/player.test.js` | player: clock ignored |
| the box starts playing once the clock is set | `scheduler/tests/player.test.js` | player: status not written |
| the box writes what it is showing to the status file and the log | `scheduler/tests/player.test.js` | player: logs status every tick |
| the box skips a video mpv can't play and logs it once | `scheduler/tests/player.test.js` | queue: failed video logged every time |
| the box exits when mpv stops, so it is restarted | `scheduler/tests/player.test.js` | mpv exit not handled |
| the website shows what is on screen now | `scheduler/tests/website.test.js` | site: no status |
| the website plays a playlist until the schedule changes | `scheduler/tests/website.test.js` | site: schedule means cleared |
| the website plays a playlist for a number of minutes | `scheduler/tests/website.test.js` | site: minutes ignored |
| the website plays a playlist until switched back | `scheduler/tests/website.test.js` | site: cleared not kept |
| the website turns the screen black | `scheduler/tests/website.test.js` | site: black is a name |
| the website previews another season | `scheduler/tests/website.test.js` | site: season folder always missing |
| the website goes back to the schedule | `scheduler/tests/website.test.js` | site: back to schedule keeps override |
| the website refuses a name that isn't a playlist | `scheduler/tests/website.test.js` | site: any name accepted |
| the website refuses a season that has no folder | `scheduler/tests/website.test.js` | site: season folder not checked |
| the website lists what it can show | `scheduler/tests/website.test.js` | site: previews without subfolders |
| the website page offers each choice | `scheduler/tests/website.test.js` | site: page without 60 minutes |

Existing scenarios, now enforced against the Node modules in `scheduler/tests/scheduler.test.js`, with a break in `logic.js` that makes each fail:

| Scenario (= test name) | Fails when |
|---|---|
| configured seasons are all valid | days: offsets ignored |
| season boundaries are inclusive | seasons: days shift by one |
| Thanksgiving: Fridays and Saturdays until Thanksgiving, then the day before and the day | seasons: alsoOn ignored |
| days written as the nth or last weekday of a month, with offsets | days: offsets ignored |
| days, and alsoOn days outside the season or with a year | seasons: alsoOn ignored |
| a season can wrap the new year, and the first listed wins on overlap | seasons: last listed wins |
| bad season entries are skipped and logged | seasons: bad entries kept |
| a playlist name resolves to today's season | no-season day still plays |
| a season playlist plays the season folder plus its subfolder | folders: only the subfolder |
| without seasons, playlists are folders in videoRoot all year | no seasons resolves to black |
| schedule status names the season | status: only the playlist |
| a scheduled period on a day with no season is black | no-season day still plays |
| the season switches at midnight inside a period that crosses it | status: only the playlist |
| on a weekday a season skips, the screen is black | no-season day still plays |
| a schedule period can be limited to weekdays | schedule: weekdays ignored |
| override with a plain playlist uses today's season | overrides ignored |
| override can preview another season, with or without a playlist | overrides ignored |
| override of a plain playlist on a day with no season explains the black | no-season day still plays |
| an override "until the schedule changes" ends at the next period | overrides ignored |
| override file validation | override files all accepted |
| season videos and subfolder videos play together, in name order, round and round | any file plays |
| a season without the playlist subfolder plays just its own videos | queue: one ahead |
| the same file name in both folders plays both copies | same-named videos play once |
| a missing season folder is reported once (not as an error) and shows black | warnings repeat |
| an empty season is reported once and shows black | warnings repeat |
| without seasons, a playlist folder plays as before | names sort without numbers |

## Workflow follow-up

- Archive the change after the PR is reviewed, so `specs.test.js` enforces the new scenarios.
- The `mac-legacy` tag (commit 644597b) is on GitHub, so the Mac version stays one checkout away.
- On the box, after merging: follow design.md's Migration Plan, then the box-only checks in `## Getting it onto the box` (smooth playback, rotation, black until the clock is set, restart after `systemctl kill`, reboot, Wi‑Fi off).
