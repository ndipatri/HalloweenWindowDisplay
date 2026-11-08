# Design

## Context

See proposal.md for why. Today:
- `scheduler/logic.js` turns `config.seasons` × `config.schedule` into a **playlist key** (`halloween/kid`), resolved against today's season (`resolve`, `foldersFor`, `scheduledKey`, `nextScheduleChange`, `whatToShow`).
- `keepPlaying` fills mpv's queue from that key's folders in name order (`listVideos`, `nextVideo`, `compareVideos`). It has special cases for `photos` (photo files allowed) and `picks` (an ordered list from `picks.json`).
- `scheduler/player.js` validates the config once at start and runs `tickNow` every second. `dropFile` and `repick` change mpv's playlist through the same `serially` queue.
- `scheduler/website.js` lists choices (`choices()`), writes `override.json` (`show()`), takes uploads, lists and saves picks, and serves one page (`PAGE`). Its pure functions (`sendBatch`, `togglePick`, `playingChoices`) sit in a DOM-free `<script>` block that tests run in `vm`.
- Day rules (`parseDay`, `parseWeekdays`, `seasonCovers`) are generic already; only their callers are season-shaped.

## Goals / Non-Goals

**Goals:**
- One model: **items** with **tags**, **filters** over tags, and filter **schedules**, replacing seasons, playlists, picks and the Photos special case.
- Reuse today's day rules, queue logic, override durations, upload PIN and lock unchanged.
- Hand edits to `filters.json` or `tags.json` take effect without a restart, like `override.json` does today.

**Non-Goals:**
- Sharing filters or box tags between boxes, or backing them up.
- "Has all of these tags" (AND), shuffle, or per-filter photo times.
- Changing sync, uploads, mpv, the emulator or the card maker.

## Decisions

### Files on the box
All files live in `~/video-scheduler/` and are written with the existing `writeText` (temp file and rename):
- **`filters.json`:**
  ```json
  { "filters": [
    { "name": "Thanksgiving",
      "anyOf": ["thanksgiving"],
      "except": [],
      "schedule": [
        { "from": "11-01", "to": "11-4thu", "weekdays": ["fri", "sat"],
          "also": ["11-4thu-1", "11-4thu"],
          "times": [{ "start": "17:00", "stop": "23:00" }] } ] } ] }
  ```
  - An entry's `from`/`to` are optional together; without them, only `also` days count.
  - `weekdays` and `also` are optional.
  - `times` is optional, meaning all day.
- **`tags.json`:** `{ "tags": { "halloween/fuzzy.mp4": ["favorites"], "photos/00001-a.jpg": ["family"] } }`. Box tags only; folder tags and `upload` are never stored.
- **`override.json`:** `{ "filter": "Thanksgiving" | null, "setAt", "expires", "untilCleared" }`. A file with `playlist` instead of `filter` fails `parseOverride` as an old override, and is removed and logged (see Overrides below). *(Rejected: converting old overrides. Their playlist keys have no exact filter.)*
- **`picks.json`:** read once by the website at start (see "Moving over"), then removed.
- **The starting set** is `scheduler/filters.default.json` in the repo, in the same format. *(Rejected: keeping it in `config.js`. A JSON file is what setup copies and what the box itself stores.)*

### Items and tags: `logic.items()`
`items()` walks the video folder:
- Each visible top folder other than `photos`, its videos (`isVideoFile(name, false)`), then each visible subfolder's videos. Videos deeper than one subfolder are not items, though sync mirrors every depth.
- Then `photos/`, its photos and videos (`isVideoFile(name, true)`).

Each item is `{ path, name, folderTags, boxTags, group }`:
- `path` is absolute and `rel` relative to the video folder.
- `folderTags` is `[tagFromFolder(rel dir)]`, or `['upload']` for uploads.
- `boxTags` comes from `tags.json`, without names already in `folderTags`.
- `group` is the page's label (`Halloween / Kid`, `Uploads`).

`tagFromFolder` lowercases the path, turns `/` and every character outside `[a-z0-9-]` into `-`, squeezes repeated dashes, and trims them from the ends. `isTagName` is `/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/`. A folder whose tag fails `isTagName` (empty, or over 30 characters) has its videos left out, logged once: `Leaving out <folder>: its name doesn't make a tag (at most 30 letters, digits and dashes).` Folders giving the same tag share it.

Names: an item's `path` is relative to the video folder everywhere outside `logic.js` (API, `tags.json`); `logic.js` adds `file`, the absolute path mpv gets.

`items()` reads `tags.json` each time. A missing or bad file reads as no box tags, logged once. Box tags whose path is no longer an item simply don't appear.

### Filters: `logic.readFilters()`, `logic.filterItems(filter)`
- **`readFilters()`** reads `filters.json` each time it is called. It caches by the file's text: an unchanged file is not reparsed, and its errors are not logged again. It returns the valid filters, in order. `checkFilter(f)` returns null or a reason. The website uses the same function to refuse a save, and the box uses it to skip a bad filter in a hand-edited file (`ERROR: Ignoring filter N (…): reason`, once per file text).
  - Names: `/^[A-Za-z0-9' -]{1,30}$/` after trimming, unique ignoring case, not `black`.
  - Each entry is checked with the existing `parseDay` (`also` days with years allowed), `parseWeekdays` and `isTime`.
- **`filterItems(filter)`** is `items()` filtered to "any `anyOf` tag in folderTags ∪ boxTags, and no `except` tag", sorted with the existing `compareVideos` (name with numbers as numbers, then path).

Because the order is plain name order, the playlist logic needs no special case. `nextVideo`, `resumeAt` and `lastQueued` work as for folder playlists today. The `ordered`/`picks` and `photos` branches in `keepPlaying` go: a playlist's items always come from `filterItems`.

### Schedule: `logic.scheduledFilter(filters, date)`, `logic.whatToShow(filters, now, overrideState)`
- **`scheduledFilter`** returns the first filter, in list order, with an entry covering `date`:
  1. For each time window, find the day it belongs to: the date itself if the time is at or after `start`. For a window crossing midnight, a time before `stop` belongs to the previous day.
  2. Check that day against the entry's days: the range (today's `seasonCovers` logic, guarded so an entry with no `from`/`to` has no range), then weekdays, or any `also` day.
  3. An entry with no times covers its days from 00:00 to 24:00.
- **`nextScheduleChange`** keeps today's minute-by-minute scan over 24 hours, comparing scheduled filter names.
- **Status lines:**
  - scheduled: `Name (scheduled until 7:30 PM)`, or `Name (scheduled all day)`;
  - nothing scheduled: `black (nothing scheduled until Wed 5:00 AM)`, or `black (nothing scheduled)` with no change within a day;
  - override: `Name (override …)`, and `black (override …)` as today;
  - clock not set: `black (waiting for the clock to be set)`, unchanged.
- **Overrides:** `whatToShow` checks the override first, as today. An override naming a filter that `readFilters()` no longer has is ended: `currentOverride` removes the file and logs `Ending the override: there is no filter called X any more.` *(Rejected: keeping it until Back to schedule. It would show black with no way to tell why from the Play buttons.)* An old-format file (`playlist`) is likewise removed, with `Ending an override from before filters (halloween/grownup).`, rather than logged on every restart.
- **Logging:** saving filters logs the website's `Filters changed (from the website): …`; the player's `Filters: …` line is only logged at start, so a save isn't logged twice.
- **Keys:** the playlist key passed to the player becomes the filter's name. The player keeps one playlist object per name, as it does per key today.

### The player
- `createPlayer` no longer validates `config.seasons`/`schedule`. Each tick calls `logic.whatToShow(logic.readFilters(), now(), overrideState)`.
- At start it logs `Filters: Halloween kid, Halloween grownup, …`, or the no-filters line. `readFilters` logs the same list again when the file's text changes.
- **`refilter()`** (today's `repick`, generalised) runs through `serially`:
  1. If nothing plays, it runs `keepPlaying`.
  2. Otherwise it trims mpv's queue behind the item on screen.
  3. If that item is still in the filter, `lastQueued` is set to it.
  4. If not, `resumeAt` is the next item after it in name order. The queue is refilled first and the item on screen removed after, so mpv moves straight on.
  5. It runs `keepPlaying` once more, to top the queue back up to three, as `repickNow` does today.
  6. If the active playlist's filter no longer exists (renamed or deleted), it does nothing; the next tick ends the override or follows the schedule.

  The website calls it, as `filtersChanged`, after any tag or filter save, and after removing an upload. A failure there is logged, not returned to the page. Uploads need no call: a new upload joins its filters at the next top-up, as today.

### The website
- **API:**
  - `GET /api/status` → `{ status }`. `season` goes, as the page reads the playing filter's name from the status.
  - `GET /api/choices` → `{ filters: [names] }`.
  - `POST /api/show { target: name | 'black', until }` refuses a filter it doesn't have, or one with no items, with the specs' wording.
  - `GET /api/items` → `{ items: [{ path, group, folderTags, boxTags, kind }], tags: [names in use] }`.
  - `POST /api/tags { path, add | remove }` takes no PIN.
  - `GET /api/filters` → `{ filters }`.
  - `POST /api/filters { filters }` requires the `X-Upload-Pin` header, with the existing `checkPin` and lock. With no PIN set it answers `Editing filters is off until a PIN is set on the box.` instead of the uploads' wording. The request-body cap (10 000 bytes today) rises to 200 000 bytes for this route, and a body over the cap is refused with `That list of filters is too long.` rather than dropped.
  - `/api/picks` goes.
  - Upload routes are unchanged. Remove also drops the item's box tags and calls `filtersChanged`.
- **Moving over:** at start, if `picks.json` exists, the website adds `favorites` to each pick that is an item, writes `tags.json`, removes `picks.json`, and logs `My picks are now tagged favorites (N).`
- **The page:**
  - **Play:** "Now: …", one button per filter (`data-choice` = the name), and Black. **For how long** stays where it is. The outline uses the pure `playingFilter(status, names)`: the text before ` (` if it's a filter name, `black` for black, else none.
  - **Tags:** the items grouped as listed. Each row has its name, folder tags as plain chips, box tags as chips with ×, a ☆/★ favorites toggle, and a small "add tag" field with a `<datalist>` of the tags in use. Each change posts to `/api/tags` and shows the answer in a note on that row.
  - **Filters:**
    - **The list:** each filter with ↑ ↓ (the pure `moveFilter(list, i, step)`), Edit and Delete, and **New filter**.
    - **The editor:** name, "any of" and "except" as tick lists of the tags in use (plus typing a new one), and schedule entries (from, to, weekday ticks, extra days, and a list of start/stop times). Day fields take the same text as today (`11-4thu`), with a one-line hint.
    - **Saving:** **Save filters** sends the whole list with the PIN field (shared with uploads, remembered the same way) and shows the answer under it. On success, it reloads the filters and the Play buttons.
  - **Removed:** the Seasons row, the Kid/Grownup/My picks/All uploads buttons as fixed buttons, and the My picks section.
  - **Unchanged:** Add photos or videos, the uploads list, New videos from GitHub, and Recent activity.
- **Pure functions** stay in the DOM-free `<script>` block for `vm` tests: `sendBatch`, `playingFilter` and `moveFilter`. `togglePick` and `playingChoices` go.

### Setup
`setup.sh` copies `scheduler/filters.default.json` to `$VIDEOS/filters.json`, mode 644, only when that file doesn't exist. It does this after making the video folder and before its `owned "$videos"` line, so the file ends up the person's on a real box (the dry run can't show ownership, as `owned` is a no-op under `TVBOX_ROOT`; the rehearsal checks it). It prints `Added the starting filters (Halloween kid, …).` or nothing. `filters.default.json` is not copied to `/opt/tvbox`, as only setup reads it.

### Config
`config.js` drops `seasons` and `schedule`, and their long comments, pointing instead to the website's Filters. `videoExtensions`, `photoSeconds`, `photoExtensions`, `uploads` and `box` stay.

### How each scenario's test reaches the behaviour
- **`scheduler.test.js`** loads `createScheduler` with fake files and folders, exposing:
  - `tags` ("Folders give each video one tag", "Every upload is tagged upload") through `items()`;
  - `filters` matching, order and nothing-to-show through `createPlaylist(name)`, `filterItems` and `keepPlaying` with `FakeMpv`;
  - "Bad filters in the filters file", "The starting filters" (reading the real `scheduler/filters.default.json`) and all of `filter-schedule` through `readFilters`, `scheduledFilter` and `whatToShow` at chosen moments;
  - the `overrides` scenarios through `whatToShow` with a fake `override.json`.
- **`player.test.js`** covers `box-player`'s reworded scenarios and the two "changing while a filter plays" scenarios: `createPlayer` with `FakeMpv` and fake `filters.json`/`tags.json`, then `player.refilter()`. It also covers the two removed-upload scenarios, through the website wired to `player.dropFile` and `filtersChanged`, as today.
- **`website.test.js`** covers `override-website`, `tags` (API, moving over, removal dropping box tags) and `filters` (list, save, refuse with and without PIN) through `handle`, with `site()` and `uploads()`. The page scenarios use the HTML plus `playingFilter`/`moveFilter` in `vm`.
- **`setup.test.js`** covers "Setup gives a box the starting filters", with the existing dry run.
- **Order of work:** the change is archived (moving the new and modified requirements into `openspec/specs/`, and leaving the five retired specs with no requirements, whose files are then deleted) before the retired tests are deleted, since `specs.test.js` requires a test for every main-spec scenario. Until then `specs.test.js` is expected to fail on the retired names; it's the last check after archiving.
- **Retired scenarios' tests** are deleted, except where a scenario of the same name carries over: the day-rule, Thanksgiving, minutes, black and status scenarios, and the removed-upload pair. Those tests are rewritten to the new wording.

## Risks / Trade-offs

- **[Filters and box tags live only on one box]** → They aren't in Git or backed up, and a new SD card starts from the starting set. Accepted, as the person asked for filters on the box. An export/import button can come later.
- **[A long Tags list on a phone]** → Items are grouped, with a compact row each; boxes have tens of items.
- **[Editing day rules on a phone is fiddly]** → The starting set covers today's seasons; day fields take today's well-tested text, with a hint; the website refuses bad rules with a message naming the filter.
- **[Status read back for the outline]** → Filter names can't contain `(`, so the text before ` (` is the name.
- **[Two phones saving filters at once]** → Last save wins, as each save sends the whole list. Acceptable for one household.
- **[A big rewrite of tested code]** → Retired scenarios' behaviour moves to new scenarios with the same intent (the day rules carry over almost word for word), the rehearsal is updated, and the emulator lets the person try it before the box.

## Rehearsal

The change touches `setup.sh`, `player.js`, `website.js` and what the rehearsal checks. `scheduler/tests/e2e/inside.sh` changes:
- **Setup:** after setup, `filters.json` holds the starting filters and belongs to `pi`. The `Seasons: ` log checks (lines 124 and 150) become `Filters: `.
- **Overrides:** Halloween grownup instead of `halloween/grownup`, with the status `Halloween grownup (override until cleared)`, the logs `Halloween grownup: playing a.mp4` / `c.mp4`, and `ERROR: Skipping broken.mp4 in Halloween grownup`.
- **Uploads:** All uploads instead of `photos`, with its play-order, photo-time, PNG, HEVC and removal checks reading `All uploads: playing …`.
- **The My picks block becomes:**
  1. tag `halloween/grownup/c.mp4` and an upload `favorites`;
  2. show Favorites, and check `Favorites: playing c.mp4`;
  3. take `favorites` off `c.mp4`, and check the next item comes on at once, with no `ERROR`.
- **A filters check:** save a filter with the PIN, and check the Play choices list it.

## Getting it onto the box

Code under `scheduler/` changed, so rerun setup on the box after merging:

```sh
ssh tvbox.local
cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh
```

Setup adds the starting filters, as the box has none yet. Then check:
- **The page:** on `http://tvbox.local/`, the Play buttons read Halloween kid, Halloween grownup, Thanksgiving, Favorites, All uploads and Black.
- **The status:** on a Thanksgiving Friday or Saturday evening it reads `Thanksgiving (scheduled until 11:00 PM)`, and that morning `black (nothing scheduled until 5:00 PM)` (today it plays 5–7 AM too).
- **Tags:** the existing upload is under Tags with `upload`, and was tagged `favorites` if it had been in My picks.
- **The log:** `tail ~/video-scheduler/scheduler.log` shows `Started.`, `Filters: …` and, if there were picks, `My picks are now tagged favorites (N).`

Box-only checks: the Tags and Filters sections are comfortable on the person's phone, and editing a schedule there feels manageable. Try both in the emulator first.

## Design review

The `review-opsx-design` subagent reviewed the proposal, the specs and this design against the code and tests. Four BLOCKING findings, all mistakes in the write-up, are fixed:
- **"Black until the clock is set"** in `box-player` still expected a season status. It is now MODIFIED to the starting filters and `Halloween kid (scheduled until 7:30 PM)`.
- **"A box tag puts any item in a filter"** had the wrong name order. It is now dusk, then fuzzy.
- **The midnight scenario's Late filter** had weekdays but no date range, so it covered nothing. It now runs Jan 1 to Dec 31.
- **The untagging scenario's playlist** needed `keepPlaying` run again after the item on screen is removed. That is now step 5 of `refilter`.

Warnings:
- **Settled with the person:**
  - Thanksgiving starts evening-only with the one tag `thanksgiving`, since that holiday has no kid or grownup folders.
  - The starting set has no Christmas filter, so December isn't scheduled black.
- **Fixed in the specs and this design:**
  - Videos deeper than one subfolder are not items. The claim about sync depth was wrong.
  - Folder tags that are empty or too long are left out and logged (a new `tags` requirement), and folders giving the same tag share it.
  - With no PIN set, saving filters says `Editing filters is off until a PIN is set on the box.` (a new scenario).
  - The body cap for `POST /api/filters` rises to 200 000 bytes, with a message instead of a dropped connection.
  - Setup copies the starting filters before `owned "$videos"`. Ownership is checked in the rehearsal, not the dry run, and the scenario now checks setup's message.
  - The range check is guarded for entries with no range.
  - The order of work: archive first, then delete the retired tests and the five emptied spec files.
  - The rehearsal's `Seasons: ` checks become `Filters: `.
  - `refilter` does nothing for a filter that's gone.
  - "Back to the schedule" is MODIFIED to name Favorites.
  - The refusal wording for an empty filter with several tags.
  - Old-format overrides are removed and logged, like those for a deleted filter.
  - Saving filters is logged once.
  - `path` is relative everywhere outside `logic.js`.
