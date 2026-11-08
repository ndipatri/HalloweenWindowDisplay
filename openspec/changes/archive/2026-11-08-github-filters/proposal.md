# Proposal

## Why

Every box gets its own copy of the starting filters, and from then on each box's copies drift apart: a fix to the shared schedule has to be made on every box's website. The person wants the shared filters, and their schedules, to come from GitHub and stay read-only on the website, with the website only making, editing and deleting a box's own custom filters.

## What Changes

- **Two kinds of filter:**
  - **GitHub filters** live in the repo at `playlists/filters.json` (today's starting set: Halloween kid, Halloween grownup, Thanksgiving, Favorites, All uploads). They are the same on every box, shown on the website with their tags and schedules but with no Edit, Delete or move buttons, and changed only in GitHub.
  - **Custom filters** are made on the website, as filters are today, and kept on that box only (`~/video-scheduler/filters.json`). Only these can be created, edited, moved and deleted there, with the upload PIN.
- **GitHub filters arrive with the sync.** The hourly sync (and "Check for new videos now") copies `playlists/filters.json` to the box as `~/video-scheduler/github-filters.json` when it has changed, logging `Updated the GitHub filters.` If the repo has none, the box's copy is removed. No setup rerun is needed for a schedule change in GitHub.
- **Custom filters rank above GitHub filters.** Where their times overlap, a custom filter wins, and custom filters come first among the Play buttons. The person orders custom filters among themselves with ↑ ↓; GitHub filters keep the order they have in the repo.
- **Names:** a custom filter can't have a GitHub filter's name, ignoring case. The website refuses it (`Halloween kid: GitHub has a filter called Halloween kid; pick another name.`). One already in `filters.json` is left out and logged.
- **Moving over:**
  - setup no longer copies a starting set; the first sync brings the GitHub filters;
  - the copies of the starting filters that boxes already hold in `filters.json` are dropped when the website starts, if GitHub has a filter of the same name (`Dropping the custom filter Halloween kid: GitHub has a filter of that name.`);
  - `scheduler/filters.default.json` moves to `playlists/filters.json`.
- Unchanged: tags, schedules' day and time rules, overrides, uploads, the PIN.

## Capabilities

### New Capabilities

### Modified Capabilities
- `filters`: filters come from two places, GitHub (read-only) and custom (the box's own); custom rank first; names can't clash; the GitHub filters replace the starting set; setup no longer copies filters.
- `video-sync`: sync copies the GitHub filters to the box.
- `override-website`: the page shows GitHub filters read-only and edits only custom ones.

## Impact

- `scheduler/logic.js`: read both files, custom first, drop clashing custom filters, each marked with where it came from.
- `scheduler/website.js`:
  - `GET /api/filters` answers `{ custom, github }`;
  - `POST /api/filters` saves custom filters only and refuses GitHub names;
  - the start-up move-over drops custom copies;
  - the page's Filters section has a read-only "From GitHub" list.
- `scheduler/sync_videos.sh`: copy `playlists/filters.json`.
- `scheduler/setup.sh`: no starting-filters copy.
- `playlists/filters.json` (moved from `scheduler/filters.default.json`); `playlists/README.md`.
- Tests: `scheduler.test.js`, `player.test.js`, `website.test.js`, `sync.test.js` and `setup.test.js`; the rehearsal's `inside.sh`.
- README ("What's playing", "Change what plays when") and the window-display-schedule skill (adding a season's filter is now a repo change).
- On the box: rerun setup once (code changed). After that, GitHub filter changes arrive with the hourly sync.

## Product decisions

From the person:
- GitHub filters are read-only on the website; the website creates, edits and deletes only custom filters.
- GitHub filter changes reach the boxes with the hourly sync.
- Custom filters rank above GitHub filters.

## Assumed product decisions

Mine; change any of them.
- The GitHub filters live at `playlists/filters.json`, beside the videos whose folders give the tags.
- A custom filter can't share a GitHub filter's name. A clashing one in `filters.json` is left out and logged, and is dropped from the file when the website starts.
- GitHub filters can't be reordered on the website; their order is the repo file's.
- When the repo has no `playlists/filters.json`, sync removes the box's copy, so only custom filters remain.
