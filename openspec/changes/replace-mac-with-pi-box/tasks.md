# Tasks

## 1. Tests first

- [ ] 1.1 Rewrite the loader in `scheduler/tests/scheduler.test.js` to require `scheduler/logic.js` with fake `io`, and move the six playback tests from the fake AVQueuePlayer to a fake mpv, keeping every test name and what it checks; verify all 26 fail only because `logic.js` doesn't exist yet
- [ ] 1.2 Write `scheduler/tests/player.test.js`: one test per box-player scenario, named exactly as the scenario, with a fake mpv, clock file and folders
- [ ] 1.3 Write `scheduler/tests/website.test.js`: one test per override-website scenario, named exactly as the scenario, calling `handle()` with fake files and a fixed `now`
- [ ] 1.4 Run the tests and verify each new test fails on a missing module or an assertion, not a typo; run `node openspec/check-scenarios.js replace-mac-with-pi-box` and verify no scenario is missing a test

## 2. The logic as Node modules

- [ ] 2.1 Add `scheduler/config.js` with the seasons and schedule from the JXA script and the box settings; verify `node --check`
- [ ] 2.2 Add `scheduler/logic.js` with the logic moved function by function, and `keepPlaying` over mpv; verify the 26 scheduler tests pass

## 3. The player

- [ ] 3.1 Add `scheduler/mpv.js` (start mpv, IPC commands, properties, events) and `watchMpv`; verify the mpv exit scenario's test passes
- [ ] 3.2 Add `scheduler/player.js` (`createPlayer`, `tick`, clock check, status and log, `main`); verify every box-player test passes

## 4. The website

- [ ] 4.1 Add `scheduler/website.js` (`createWebsite`, `handle`, the page, `main` hook); verify every override-website test passes

## 5. Setup and removal of the Mac code

- [ ] 5.1 Add `scheduler/systemd/tvbox.service`, `tvbox-sync.service`, `tvbox-sync.timer` and `scheduler/setup.sh`; verify `bash -n scheduler/setup.sh` and that a dry run against a temporary root (`TVBOX_ROOT`, with fake `apt-get`, `systemctl`, `timedatectl` and `usermod` on `PATH`) writes the units and app files
- [ ] 5.2 Remove `video_scheduler.js`, `show.sh`, `start.sh`, `install.sh` and the launchd plist; verify `grep -rn "osascript\|launchctl\|video_scheduler.js" scheduler` finds nothing
- [ ] 5.3 Update the README (what the box is, using the website, if something's wrong) and both skills for the box; verify the README has no commands but the website address and the setup lines, and that the overrides spec's Purpose names the website

## 6. Verification

- [ ] 6.1 Run every test file and `node --check` on each `.js` file in `scheduler/`, and verify they pass
- [ ] 6.2 Run `node openspec/check-scenarios.js replace-mac-with-pi-box` and verify every scenario has its test
- [ ] 6.3 Disable check: break the code each new or moved test depends on, rerun, verify each fails, then restore; list any that pass either way
- [ ] 6.4 Add the scenario-to-test table below
- [ ] 6.5 Run `openspec validate replace-mac-with-pi-box --strict` and verify it is valid

## Workflow follow-up

- Archive the change after the PR is reviewed, so `specs.test.js` enforces the new scenarios.
- Push the `mac-legacy` tag (commit 644597b) before merging.
- On the box, after merging: follow design.md's Migration Plan, then the box-only checks in `## Getting it onto the box` (smooth playback, rotation, black until the clock is set, restart after `systemctl kill`, reboot, Wi‑Fi off).
