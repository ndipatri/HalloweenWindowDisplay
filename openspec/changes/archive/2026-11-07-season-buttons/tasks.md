# Tasks

## 1. Tests first

- [x] 1.1 In `scheduler/tests/website.test.js`:
  - add `the page offers each season as a Play button`;
  - change `the page works out which Play button is playing from the status` to `playingChoices(status, playlists, seasons, today)`, which returns a list;
  - stop `the page confirms the picks next to the list` from depending on the Preview heading.

  Verify the new and changed tests fail on an assertion.

## 2. The page

- [x] 2.1 In `scheduler/website.js`'s page:
  - a "Seasons" row in the Play card, with a button per preview (`data-choice` = the preview);
  - remove the Preview a season section and its script;
  - `playingChoices` in the DOM-free block;
  - `outline()` for every `[data-choice]` button in the card.

  Verify the tests pass and the page script compiles.
- [x] 2.2 README and the skill: seasons are Play buttons, and there's no Preview a season.
- [x] 2.3 Try it in the emulator on a phone-sized screen: tap Thanksgiving, then Halloween / Grownup, and check the outline. This found that, on a Thanksgiving day, Halloween / Grownup also outlined Grownup, which plays Thanksgiving's grownup videos (a flaw from play-shows-current). Kid and Grownup now match only today's season, given by `GET /api/status`'s new `season`. Checked again: Halloween / Grownup alone for `halloween/grownup`, and Grownup alone for `thanksgiving/grownup`.

## 3. Verification

- [x] 3.1 Run every test file (Linux image), `node openspec/check-scenarios.js season-buttons` and `openspec validate season-buttons --strict`.
- [x] 3.2 Disable check: with the old page, the new and changed tests fail.
- [x] 3.3 Implementation review: `review-orchestrator` on the change. Fix every BLOCKING finding. Round 1: one BLOCKING (the window-display-video skill still said Preview a season: fixed). Warnings fixed: with no seasons, folders named like a schedule playlist aren't repeated as season buttons, and are outlined once; the test now checks the `seasonNames` and `r.season` wiring, and slices `load()` to the next section; tasks and README wording. Accepted: `season` comes from the website's clock, not the player's last tick, so the Kid/Grownup outline can lag by up to a second at midnight on a season change.

No design.md: a page-only change with no new architecture. No rehearsal: none of its checks reach the page's script.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`.
