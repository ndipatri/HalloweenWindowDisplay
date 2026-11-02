# Tasks

## 1. Specs for the existing tests

- [x] 1.1 Write `specs/seasons/spec.md` with one scenario per season test and verify each scenario name matches its test with `node openspec/check-scenarios.js baseline-scheduler-specs`
- [x] 1.2 Write `specs/daily-schedule/spec.md` with one scenario per schedule and status test, verified the same way
- [x] 1.3 Write `specs/overrides/spec.md` with one scenario per override test, verified the same way
- [x] 1.4 Write `specs/playlists/spec.md` with one scenario per playlist and playback test, verified the same way

The test-first group is not needed here: the tests already exist and pass, and this change adds no behaviour.

## 2. Verification

- [x] 2.1 Run every test file and `node --check scheduler/video_scheduler.js`, and verify they pass (26 scheduler tests, 5 spec tests)
- [x] 2.2 Run `node openspec/check-scenarios.js baseline-scheduler-specs` and verify it reports all 26 scenarios as having a test
- [x] 2.3 Disable check: in a throwaway copy, break one scheduler function at a time (18 breaks, such as shifting season days by one, ignoring `alsoOn`, ignoring period weekdays, letting the last listed season win, ignoring overrides, sorting names without numbers, warning every time) and rerun the tests; verify every test fails under at least one break. None passed either way.
- [x] 2.4 Add the scenario-to-test table below, listing each scenario after its test passed the disable check
- [x] 2.5 Run `openspec validate baseline-scheduler-specs --strict` and verify it is valid

All 26 scenarios are enforced by the test of the same name in `scheduler/tests/scheduler.test.js`, so the table lists them by capability with a break that makes each fail:

| Capability | Scenario (= test name) | Fails when |
|---|---|---|
| seasons | configured seasons are all valid | day offsets are ignored |
| seasons | season boundaries are inclusive | season days shift by one |
| seasons | Thanksgiving: Fridays and Saturdays until Thanksgiving, then the day before and the day | `alsoOn` is ignored |
| seasons | days written as the nth or last weekday of a month, with offsets | day offsets are ignored |
| seasons | days, and alsoOn days outside the season or with a year | `alsoOn` is ignored |
| seasons | a season can wrap the new year, and the first listed wins on overlap | the last listed season wins |
| seasons | bad season entries are skipped and logged | every season entry is accepted |
| daily-schedule | schedule status names the season | the status is only the playlist name |
| daily-schedule | a scheduled period on a day with no season is black | a no-season day still plays |
| daily-schedule | on a weekday a season skips, the screen is black | a no-season day still plays |
| daily-schedule | the season switches at midnight inside a period that crosses it | season days shift by one |
| daily-schedule | a schedule period can be limited to weekdays | period weekdays are ignored |
| overrides | override with a plain playlist uses today's season | overrides are ignored |
| overrides | override can preview another season, with or without a playlist | overrides are ignored |
| overrides | override of a plain playlist on a day with no season explains the black | overrides are ignored |
| overrides | an override "until the schedule changes" ends at the next period | overrides are ignored |
| overrides | override file validation | every override file is accepted |
| playlists | a playlist name resolves to today's season | names ignore the season |
| playlists | a season playlist plays the season folder plus its subfolder | only the subfolder plays |
| playlists | without seasons, playlists are folders in videoRoot all year | no seasons resolves to black |
| playlists | without seasons, a playlist folder plays as before | names sort without numbers |
| playlists | season videos and subfolder videos play together, in name order, round and round | any file plays, not only videos |
| playlists | a season without the playlist subfolder plays just its own videos | only the subfolder plays |
| playlists | the same file name in both folders plays both copies | same-named videos play once |
| playlists | a missing season folder is reported once (not as an error) and shows black | warnings repeat every time |
| playlists | an empty season is reported once and shows black | warnings repeat every time |

## Workflow follow-up

- Archive this change in the same PR, so `scheduler/tests/specs.test.js` enforces the 26 scenarios from `openspec/specs/` as soon as it is merged.
- After the PR is merged, on the Mac: `cd ~/HalloweenWindowDisplay && git pull`. No installer run is needed, since no scheduler code changed.
