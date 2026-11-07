# Tasks

## 1. Tests first

- [x] 1.1 In `scheduler/tests/website.test.js`, rename `the page confirms the picks next to the list and offers Play my picks` to `the page confirms the picks next to the list`. Check the new note wording and that the section has no button. Verify it fails on an assertion.

## 2. The page

- [x] 2.1 In `scheduler/website.js`, remove `#play-picks`, its handler, `playTapped` and the `playing` note state and style. Change the note to `Tap My picks under Play to show them.` Verify the tests pass and the page script compiles.
- [x] 2.2 Try it in the emulator: tick two items, read the note, tap My picks under Play.

## 3. Verification

- [x] 3.1 Run every test file (Linux image), `node openspec/check-scenarios.js drop-play-my-picks` and `openspec validate drop-play-my-picks --strict`.
- [x] 3.2 Disable check: with the old page, the changed test fails.
- [x] 3.3 Implementation review: skipped for removing a button and its code, with the test checking it's gone.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`.
