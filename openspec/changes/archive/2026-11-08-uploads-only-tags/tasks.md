# Tasks

## 1. Tests first

- [x] 1.1 In `scheduler/tests/website.test.js`, rewrite the tag tests for uploads:
  - `the website adds a box tag to an upload`;
  - `the website removes a box tag from an upload`;
  - `the website refuses a tag name it can't use`;
  - `the website refuses to tag something that isn't an item`;
  - `box tags of an item no longer on the box are left out`;
  - `the box turns the old picks into favorites`;
  - `the website page offers tagging items`.

  Add `the website refuses to tag a video from GitHub`, `the website lists the uploads and their tags` and `box tags on a video from GitHub are ignored and dropped`. Remove the tests of the removed scenarios. Verify the new and changed ones fail on an assertion.
- [x] 1.2 In `scheduler/tests/scheduler.test.js`, replace `a box tag puts any item in a filter` with `a box tag puts an upload in a filter`. Move the extra `tags.json` test to uploads. Verify they fail on an assertion.
- [x] 1.3 In `scheduler/tests/player.test.js`, move the Favorites refilter tests to uploads (`photos/00001-a.jpg` …). Verify they still pass, as uploads can be tagged before and after.

## 2. The code

- [x] 2.1 `scheduler/logic.js`: `items()` gives box tags only to uploads. Verify the scheduler tests pass.
- [x] 2.2 `scheduler/website.js`:
  - `/api/tags` refuses repo videos (before any other check on the tag);
  - `/api/items` lists uploads, with the tags in use over every item;
  - `writeBoxTags` keeps only uploads' entries;
  - the picks move-over keeps only uploads;
  - the page's Tags hint and `the upload` wording.

  Verify the website tests pass and the page script compiles.

## 3. Rehearsal and docs

- [x] 3.1 `scheduler/tests/e2e/inside.sh`: tag two uploads `favorites` instead of a repo video and an upload, and adjust the Favorites checks.
- [x] 3.2 README ("Favorites and tags") and the window-display-schedule skill (box tags on uploads only; `/api/tags` refusal; `tags.json`).

## 4. Verification

- [x] 4.1 Run every test file (Linux image), `node --check`, `node openspec/check-scenarios.js uploads-only-tags` and `openspec validate uploads-only-tags --strict`.
- [x] 4.2 Disable check: with the old `logic.js` and `website.js`, the seven tests of the new behaviour fail (a box tag puts an upload in a filter; refuses to tag a video from GitHub; lists the uploads; box tags on a GitHub video ignored and dropped; old picks into favorites; the page's Tags hint; removing an upload drops box tags). The rewritten upload-tag tests (add, remove, refuse names, not an item, repeat a folder tag) pass either way, as tagging an upload works as before.
- [x] 4.3 Rehearsal (cached image): record the result line. Result: `66 passed, 0 failed` (the new check: a video from GitHub can't be tagged).
- [x] 4.4 Emulator on a phone-sized screen: Tags lists only the one upload, starring it shows `✓ Tagged 00001-pumpkin.jpg favorites.`, and Favorites plays.
- [x] 4.5 Archive, then confirm `specs.test.js` and `node openspec/check-scenarios.js` pass.
- [x] 4.6 Implementation review: `review-orchestrator` on the change; fix every BLOCKING finding. Round 1: no BLOCKING findings. Warnings fixed:
  - the website decides "upload" by the `photos/` path, so a GitHub folder named `upload` can't be tagged (test added);
  - stale comments in `website.js` and `logic.js`, and the tags spec's purpose;
  - the GitHub-video test now shows Favorites refusing a repo-only favorite, and the player test tags an upload;
  - the unreachable folder-tag check is removed;
  - tests added for the order of refusals and for no uploads.

No design.md: a narrowing of existing behaviour with no new architecture.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Then **Tags** on `http://tvbox.local/` lists only the uploads.
