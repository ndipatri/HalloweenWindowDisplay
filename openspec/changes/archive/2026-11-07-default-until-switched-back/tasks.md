# Tasks

## 1. Tests first

- [x] 1.1 In `scheduler/tests/website.test.js`, add `the page starts For how long on until switched back`: only the `cleared` option is `selected`. Verify it fails on an assertion. The existing `the website plays a playlist until the schedule changes` keeps the API's own default.

## 2. The page and the docs

- [x] 2.1 In `scheduler/website.js`, mark `<option value="cleared">` as `selected`. Verify the test passes and the page script compiles.
- [x] 2.2 README: say a choice stays on until Back to schedule unless a shorter time is picked, in place of "They end by themselves". In the skill, give the page's default next to the durations.

## 3. Verification

- [x] 3.1 Run every test file (Linux image for sync and cards), `node openspec/check-scenarios.js default-until-switched-back` and `openspec validate default-until-switched-back --strict`.
- [x] 3.2 Disable check: with the old page, the new test fails.
- [x] 3.3 Implementation review: skipped, as the change is a single `selected` attribute plus wording. The test and the disable check cover it.

No design.md and no rehearsal: a one-attribute page change.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`, then open `http://tvbox.local/`: For how long shows Until switched back.
