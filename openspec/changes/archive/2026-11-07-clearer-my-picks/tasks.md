# Tasks

## 1. Tests first

- [x] 1.1 In `scheduler/tests/website.test.js`, add `the page confirms the picks next to the list and offers Play my picks` (the HTML: the hint line, the note's wording, the Play my picks button wired to `show('picks')`). Verify it fails on an assertion before the page changes.

## 2. The page

- [x] 2.1 In `scheduler/website.js`'s page, add the hint line, the sticky bar with `#picknote` and `#play-picks`, and `notePicks()`. Use it for saving, saved, refused, nothing picked and showing now, kept current by `refresh()`. Stop saves writing to the message line. Verify the test passes and the page script compiles.
- [x] 2.2 Try it in the emulator (also: Play my picks reads `Starting…`, then the note says `▶ Playing your picks …`; tried after the person found the button gave no sign of being tapped) (`bash scheduler/tests/e2e/emulate.sh`) on a phone-sized screen: tick two items and read the note, then tap Play my picks and read it again.

## 3. Verification

- [x] 3.1 Run every test file and `node --check` on `scheduler/website.js`.
- [x] 3.2 Run `node openspec/check-scenarios.js clearer-my-picks` and `openspec validate clearer-my-picks --strict`.
- [x] 3.3 Disable check: with the old page, the new test fails.

- [x] 3.4 Implementation review: `review-orchestrator` on the change against `origin/main`'s My picks page. Fix every BLOCKING finding. Round 1: one BLOCKING (the note wasn't announced to screen readers: now `role="status" aria-live="polite"`, checked by the test). Warnings fixed: the note keeps "Playing your picks" until the status catches up (5 s at most); no "ticks were put back" when the box can't be reached; a list read while a save is on its way no longer overwrites it; the bar has bottom padding and the button a fixed width. Accepted: the test checks the page's wording and wiring, not each note state in `vm`, as `notePicks` lives in the DOM script.

No design.md: a page-only change with no new architecture, so there's no design review. The rehearsal isn't needed, as none of its checks reach the page's script.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Then on `http://tvbox.local/`, tick something under My picks: the note under the list says `✓ Saved.`, and Play my picks shows it.
