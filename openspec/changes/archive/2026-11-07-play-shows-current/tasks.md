# Tasks

## 1. Tests first

- [x] 1.1 In `scheduler/tests/website.test.js`, add `the page shows the status under Play and outlines what is playing` (the HTML and its wiring) and `the page works out which Play button is playing from the status` (the page script's `playingChoice` in `vm`, as `togglePick` is). Verify each fails on an assertion.

## 2. The page

- [x] 2.1 In `scheduler/website.js`'s page:
  - move `#status` into the Play section above the grid, after "Now:", and drop the card at the top;
  - give the Play buttons `data-choice` (`kid`, `grownup`, `picks`, `photos`, `black`);
  - add `playingChoice(status, playlists)` in the DOM-free script block;
  - in `refresh()`, outline the matching button (class `current`, `aria-pressed`).

  Verify the tests pass and the page script compiles. Keep `the website says when the box has not started yet` passing.
- [x] 2.2 Try it in the emulator on a phone-sized screen. Check the outline:
  - on black;
  - after choosing My picks;
  - after choosing Kid.

## 3. Verification

- [x] 3.1 Run every test file (Linux image for sync and cards) and `node --check scheduler/website.js`.
- [x] 3.2 Run `node openspec/check-scenarios.js play-shows-current` and `openspec validate play-shows-current --strict`.
- [x] 3.3 Disable check: with the old page, both new tests fail.
- [x] 3.4 Implementation review: `review-orchestrator` on the change. Fix every BLOCKING finding. Round 1: one BLOCKING (togglePick's comment left above playingChoice: moved back). Warnings fixed: no outline when the box can't be reached; the status line and the picks note are only rewritten when their text changes, so screen readers don't repeat them every poll; `aria-current` instead of `aria-pressed`, as tapping again turns nothing off (spec and test changed to match); more status cases in the test and the spec (no seasons, black asked for a playlist, an unscheduled playlist, no status); the test reads `refresh()` up to the next declaration rather than a fixed length. Accepted: the page reads the status wording rather than a structured field from the box.

No design.md: a page-only change with no new architecture, so there's no design review. The rehearsal isn't needed, as none of its checks reach the page's script.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`, then open `http://tvbox.local/`: the status is under Play and the playing button is outlined.
