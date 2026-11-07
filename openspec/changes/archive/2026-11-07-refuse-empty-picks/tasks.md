# Tasks

## 1. Tests first

- [x] 1.1 In `scheduler/tests/website.test.js`, add `the website refuses My picks while nothing is picked`. Verify it fails on an assertion.

## 2. The website

- [x] 2.1 In `scheduler/website.js`'s `show()`, refuse `picks` when `logic.readPicks().filter(logic.pickable)` is empty. Verify the test passes, and that the existing website and player tests (which pick before showing) still pass.
- [x] 2.2 Try it in the emulator: tap My picks with nothing picked; the answer shows under Play and the window stays as it was.

## 3. Verification

- [x] 3.1 Run every test file (Linux image), `node openspec/check-scenarios.js refuse-empty-picks` and `openspec validate refuse-empty-picks --strict`.
- [x] 3.2 Disable check: with the old `show()`, the new test fails.
- [x] 3.3 Implementation review: skipped for a three-line guard with its test.
- [x] 3.4 Rehearsal: the My picks check in `inside.sh` saves picks before showing them, so it is unaffected; not rerun.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`.
