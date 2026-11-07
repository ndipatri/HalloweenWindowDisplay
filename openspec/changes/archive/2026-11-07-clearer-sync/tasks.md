# Tasks

## 1. Tests first

- [x] 1.1 In `scheduler/tests/website.test.js`:
  - change the two sync reply tests to the new wording;
  - rename `the website page offers Sync now and shows recent activity` to `the website page offers checking for new videos and shows recent activity`, checking the heading, the explaining line and the button.

  Verify each fails on an assertion.

## 2. The page and the docs

- [x] 2.1 In `scheduler/website.js`, change the two replies, and the section's heading, add its explaining line, and relabel its button. Verify the tests pass and the page script compiles.
- [x] 2.2 README, the skill and `inside.sh`'s check names: "Check for new videos now" in place of "Sync now".
- [x] 2.3 Try it in the emulator: tap the button, read the reply, and watch Recent activity. Trying it showed the reply landing in the message line near the top, out of view, so it now shows just under the button (`#sync-note`; `post(..., quiet)` keeps it out of the top line).

## 3. Verification

- [x] 3.1 Run every test file (Linux image), `node openspec/check-scenarios.js clearer-sync` and `openspec validate clearer-sync --strict`.
- [x] 3.2 Disable check: with the old website, the three changed tests fail.
- [x] 3.3 Implementation review: skipped for a wording change.
- [x] 3.4 Rehearsal: its sync checks read the log, not the replies, so only their names changed. Not rerun.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`.
