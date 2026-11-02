# Tasks

## 1. Tests first

- [x] 1.1 Write `scheduler/tests/sync.test.js`: one test per video-sync scenario, named exactly as the scenario, running the real `sync_videos.sh` against throwaway folders with a local bare repository as GitHub; verify `node openspec/check-scenarios.js add-sync-specs` reports no missing test
- [x] 1.2 Run the tests. The behaviour already existed, so the tests were expected to pass at once. Instead the run hung: every sync held its output open for the full 60-second pull limit after finishing. Traced to the pull watchdog's leftover `sleep`.

## 2. The fix the tests found

- [x] 2.1 Run the pull under `timeout --kill-after=5 "$pull_timeout"` instead of the watchdog, logging 124/137 as `no answer within N seconds` as before; verify `bash -n`, and that all tests pass in about 6 seconds
- [x] 2.2 Add the requirement "Leaves nothing running" with the scenario "sync leaves nothing running when it finishes" and its test, so the old watchdog can't come back unnoticed

## 3. Verification

- [x] 3.1 Run every Node test file and verify they pass (13 player, 26 scheduler, 5 spec, 13 sync, 13 website)
- [x] 3.2 Run `node openspec/check-scenarios.js add-sync-specs` and verify every scenario has its test
- [x] 3.3 Disable check: in a copy, break `sync_videos.sh` one way at a time (14 breaks), rerun, and verify every test fails under at least one. The first pass found "sync leaves a season folder the repo doesn't have alone" passing either way: its test only had a video directly in `easter/`, which sync never touches. The guard protects season subfolders, so the scenario and test now include `easter/kid/chick.mp4`, and the break fails it. A break for new videos not being copied was also added. Result: all 13 tests fail under at least one break.
- [x] 3.4 Add the scenario-to-test table below
- [x] 3.5 The change touches `sync_videos.sh`, which the rehearsal runs: run `bash scheduler/tests/e2e/box.e2e.sh` and verify `23 passed, 0 failed`
- [x] 3.6 Run `openspec validate add-sync-specs --strict` and verify it is valid

Every scenario is enforced by the test of the same name in `scheduler/tests/sync.test.js`. Each row gives a break to `sync_videos.sh` that makes that test fail:

| Scenario (= test name) | Fails when |
|---|---|
| sync pulls the latest from GitHub before copying | never pulls |
| sync without pulling copies the repo as it is | --no-pull still pulls |
| sync leaves nothing running when it finishes | watchdog left running (the old way) |
| sync uses the videos already in the repo when GitHub can't be reached | pull failure not explained |
| sync gives up on a pull that doesn't answer in time | no time limit on the pull |
| sync copies new videos from the repo | new videos not copied |
| sync replaces a video that changed in the repo | changed videos not copied |
| sync leaves a video that hasn't changed alone | unchanged videos copied again |
| sync copies only videos | every file copied |
| a video that fails to copy leaves nothing half-copied | copied straight into place |
| sync moves a video no longer in the repo aside, never deleting it | removed videos deleted |
| sync moves aside the videos of a subfolder no longer in the repo | removed subfolders kept |
| sync leaves a season folder the repo doesn't have alone | other seasons set aside too |

## Workflow follow-up

- Archive this change after review, so `specs.test.js` enforces the video-sync scenarios.
- On the box, after merging: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`, then check that the next sync line in `~/video-scheduler/scheduler.log` is `Pulled the latest from GitHub (…)`.
