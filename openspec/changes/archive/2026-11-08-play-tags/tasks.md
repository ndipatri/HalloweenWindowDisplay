# Tasks

## 1. Overrides play tags and filters

- [x] 1.1 `parseOverride` reads `{ tags, filters, setAt, expires, untilCleared }` and ends an override from before tags with a log line; `pickName` names the mix (`#a + Filter`); `playlistItems` parses it back. Verify: the override tests in `scheduler/tests/scheduler.test.js` and `player.test.js` pass.
- [x] 1.2 An override naming a filter that's gone is ended and logged; chosen tags with nothing in them show black and say so once. Verify: the matching scenario tests pass.
- [x] 1.3 A filter without days and times is refused and skipped, and `playlists/filters.json` keeps only Halloween kid, Halloween grownup and Thanksgiving. Verify: "a filter without days and times is refused and skipped" and "the GitHub filters are today's seasons" pass.

## 2. The website

- [x] 2.1 `GET /api/choices` gives `{ tags, filters }`; `POST /api/show` takes `{ tags, filters, until }` (or black) and refuses unknown tags or filters and an empty pick. Verify: the `/api/show` and choices tests in `website.test.js` pass.
- [x] 2.2 The page's Play section offers a button per tag (as words) and per filter, to pick several, then Play; it outlines what is playing from the status. Verify: the page tests in `website.test.js` pass, and on the emulator at a phone size picking two tags and tapping Play shows the mix in "Now" with both outlined.

## 3. Rehearsal and docs

- [x] 3.1 The rehearsal (`scheduler/tests/e2e/inside.sh`) plays a filter, the `upload` and `favorites` tags, and a tag with a filter, through the new API. Verify: the rehearsal passes in the `tvbox-e2e` image.
- [x] 3.2 README, `playlists/README.md`, the window-display-schedule and window-display-video skills and `config.js` describe playing tags and filters from Play, and the three GitHub filters. Verify: no mention of All uploads or a Favorites filter is left (`grep`).

## 4. Verification

- [x] 4.1 All tests pass on Linux (`tvbox-node-tests` image), and `node openspec/check-scenarios.js` passes after archive. Verify: the commands' output.
- [x] 4.2 The new tests fail with the change's code reverted (disable check). Verify: the failing test names.
- [x] 4.3 `review-orchestrator` on the whole change, repeated until no BLOCKING findings remain. Verify: the review's findings and their fixes.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`, then check the website and the log.
