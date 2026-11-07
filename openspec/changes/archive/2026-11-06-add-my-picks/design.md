# Design

## Context

See proposal.md for why. Today (after the upload change):
- An override names one playlist key; `logic.resolve()` turns it into folders (`foldersFor`), and `keepPlaying()` keeps mpv's playlist at three entries (the playing one and two queued), choosing the next item by **name order** across those folders (`listVideos`, `nextVideo`, `compareVideos`).
- `photos` is a kept name: `resolve('photos')` is `photos`, `createPlaylist` marks it `photos: true` so photo files play, and `validSchedule` / `seasonError` reject it with a reason.
- The website (`scheduler/website.js`) lists choices from the video folder, writes `override.json`, takes uploads into `photos/`, and calls `options.beforeRemove` (the player's `dropFile`, serialised with the tick) before deleting an upload.
- The page is one string (`PAGE`) with its own script; page tests pull a pure function out of that script and run it in `vm` (`sendBatch`).

## Goals / Non-Goals

**Goals:**
- A second kind of playlist whose items are an explicit, ordered list of files from anywhere in the video folder, played round and round.
- One rule for what can be picked, shared by the website (to list and to refuse) and the scheduler (to play).
- Changing the picks while they play shows on screen at once.

**Non-Goals:**
- Reordering other than untick and tick again.
- Several named pick lists.
- Picks on the schedule, or picks shared between boxes. `picks.json` lives on one box, like the uploads.

## Decisions

### The picks live in `~/video-scheduler/picks.json`
`{"picks": ["thanksgiving/dusk.mp4", "photos/00001-a.jpg"]}`: paths relative to the video folder, in pick order, written with the existing `writeText` (temp file and rename, so a reader never sees half a file). A file that isn't valid JSON, or has no `picks` list, reads as no picks; non-string entries are dropped.
- *Rejected:* a `picks/` folder of symlinks. Sync and the folder listing would have to learn about links, a link breaks silently when sync moves a video, and order would have to be put into the names.
- *Rejected:* keeping the list in `override.json`. It is deleted when the override ends, and the person asked for the picks to be remembered.

### `picks` is a second kept name, beside `photos`
In `logic.js`, `PICKS = 'picks'`. `resolve('picks')` is `picks` (like `photos`, whatever the season or with no seasons). `validSchedule` and `seasonError` reject `picks` with their own reason (`… plays only when chosen on the website` / `the name picks is kept for My picks`), the same code path as `photos`. The website's previews skip a `picks` folder. `show()` refuses `picks/…` next to its `photos/…` refusal (`Not a playlist name: picks/x. My picks plays the picked items.`), so a `picks` folder can't be chosen. Sync is not changed: nothing is ever stored under `picks/`, so a repo folder of that name only syncs a folder nobody can choose.

### One rule for "pickable": `logic.pickable(path)`
A path can be picked when it is `<top>/<file>` or `<top>/<sub>/<file>`, no part is empty or starts with `.`, `<top>` is not `picks`, the file is in its folder (`listFolder` of the parent includes the name), and:
- under `photos/` (one level only): a video or photo extension (`isVideoFile(name, true)`);
- anywhere else: a video extension only (`isVideoFile(name, false)`).

`logic.pickableItems()` walks the same folders the website lists as previews (top-level folders other than `photos` and `picks`, and their subfolders), then `photos/`, and returns `{ path, group }` in that order, sorted with `compareNames` within each folder. The group is the folder written the page's way (`Halloween / Grownup`), or `Uploads`. The website's `GET /api/picks` is `{ items: pickableItems(), picks: readPicks().filter(pickable) }`.

### The picks playlist plays in list order
`createPlaylist('picks')` sets `ordered: true` and no folders. In `keepPlaying`, the list of items comes from `readPicks()` instead of `listVideos(folders)`:
- each path that isn't `pickable` is left out, with `warnOnce(playlist, 'gone:' + path, 'Skipping … in picks: it is no longer on the box.')`; the warning is cleared when the path plays again;
- an empty result logs `NO_PICKS` once and shows black, like `NO_UPLOADS`.

Choosing the next item for an ordered playlist goes by **position**: the item after `lastQueued`'s path in the current list, wrapping; if `lastQueued` is no longer in the list, the first. `resumeAt` (coming back to the playlist) also goes by path: that item if still picked, else the first. Name-ordered playlists are unchanged (`nextVideo` / `compareVideos`). Items are `{ name, path }` like videos, so photo timing, failed-file logging and `filesById` work as they do.
- *Rejected:* giving picks synthetic names (`0001-…`) so the existing name sort orders them. It would leak into the log (`picks: playing 0001-dusk.mp4`) and tie order to renaming.

### Saving the picks: `POST /api/picks`
Body `{ "picks": [...] }`. Every entry must be a string and `pickable`, else the whole request is refused with `Can't pick <name>.` and nothing is written. Duplicates after the first are dropped. The website writes `picks.json`, logs `My picks: N picked (from the website).`, answers `Saved. N picked.` / `Saved. Nothing picked.`, and calls `options.picksChanged()` (a no-op when absent, as in most website tests). No PIN: picking only chooses among what is already on the box, as Preview does.

Uploads: after an upload is numbered into place, its path is appended to the picks (if not already there); after an upload is removed, its path is taken out. Both use the same read/write helpers, log nothing extra (the upload and removal lines already say what happened), and call `picksChanged()`.

### Changing the picks while they play: `player.repick()`
`player.js` exposes `repick`, run through the same `serially` queue as the tick and `dropFile`, and passed to the website as `picksChanged`. If the active playlist isn't `picks`, it does nothing (the next time picks plays, it reads the file afresh). Otherwise:
1. read mpv's playlist. With nothing on screen (nothing was picked, or everything queued has played), just run `keepPlaying` and set `idle` from its answer;
2. remove every entry after the current one;
3. if the current item is still picked: `lastQueued` = it, so the queue continues after it, and run `keepPlaying`;
4. if not: `resumeAt` = the first item after it in the playlist's previous list (kept as `playlist.order` by `keepPlaying`) that is still picked, else the first pick; run `keepPlaying`, which queues from there behind the current entry; **then** remove the current entry, so mpv moves straight on to the queued one with no black gap (the same move `dropFile` makes with later entries behind it); then run `keepPlaying` again to top the queue back up.

Items in a picks playlist are `{ name, path: videoRoot + '/' + rel }`: mpv's filenames and `nowPlaying.path` are absolute, so every position lookup compares absolute paths, and `picks.json` keeps the relative ones.

### The page
- The Play grid: Kid, Grownup (from the schedule), **My picks** (`id="picks"`, shows `picks`), **All uploads** (`id="photos"`, the old Photos button, shows `photos`), Black.
- `GET /api/choices` becomes `{ playlists, previews, photos: true, picks: true }`.
- A **My picks** section after "For how long": the items from `GET /api/picks`, under a small heading per group, each a row with a tick box, the name, and its number when picked. A tick or untick computes the new list with a pure `togglePick(picks, path)` (append if absent, else remove) and redraws the numbers at once. Saves go one at a time, in order, each posting the whole list as it is when it is sent; the answer carries the box's saved list, which the page shows once no save is waiting. A refused or failed save reads the list from the box again. The list is also reloaded after uploads and removals, and when the page comes back into focus.
- `togglePick` goes in the page's second, DOM-free `<script>` block beside `sendBatch`: the page test runs that whole block in `vm` (`batchFlow`), so it must not touch `$` or `document`.

### How each scenario's test reaches the behaviour
- **website.test.js**, through `createWebsite(...).handle` with the existing fake folders (`site()`) and the temporary folder (`uploads()`): the list, save, refuse, dedupe and empty scenarios; uploads joining and leaving the picks; the choices and both page scenarios (`togglePick` via `vm`).
- **scheduler.test.js**, through `createScheduler` with fake folders: playing in order, a single pick, no season, nothing picked, the missing pick, and the `picks` season and schedule entries. `createPlaylist` and `keepPlaying` are already exposed; `pickable`, `pickableItems` and `readPicks` are added to the returned object.
- **player.test.js**, through `createPlayer` with `FakeMpv`: both "changing the picks while they play" scenarios call the new `player.repick()` after rewriting the fake `picks.json`.

## Risks / Trade-offs

- [A long list on a phone] → items are grouped and the list is plain rows; a box has tens of videos, not thousands.
- [Sync replaces a picked video under the same name] → the path still exists, so the pick still plays the new copy. That's what the person would expect.
- [Sync moves a picked video to `.removed/`] → skipped and logged once; it drops out of the list, and out of `picks.json` the next time the picks are saved.
- [Two phones ticking at once, or a page left open across an upload] → last save wins, as each save sends the whole list; a page reloads the list when it comes back into focus, and saves from one page go in order. Acceptable for one household. Rejected: add/remove requests or versioned lists, more API for a rare case.
- [`picks.json` hand-edited badly] → reads as no picks (black, logged as nothing picked); saving from the page rewrites it.

## Rehearsal

The change touches `website.js` and `player.js`, which the rehearsal runs. The existing checks (status, overrides, uploads, removal, frames) cover that nothing else broke. New check in `scheduler/tests/e2e/inside.sh`: save picks of two test clips with `POST /api/picks`, show `picks` until cleared, and wait for the status `picks (override until cleared)` and the log line `picks: playing <first clip>`.

## Getting it onto the box

Code under `scheduler/` changed, so after merging, rerun setup on the box:

```sh
ssh tvbox.local
cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh
```

Setup asks nothing new and keeps the upload PIN. Then open `http://tvbox.local/`: the Play buttons read Kid, Grownup, My picks, All uploads, Black, and My picks lists the videos and uploads. Tick two, tap My picks: the status reads `picks (override …)`, and `tail ~/video-scheduler/scheduler.log` shows `My picks: 2 picked (from the website).` and `picks: playing …`. The existing upload on the box is not in the picks until ticked (only new uploads join by themselves).

## Design review

The `review-opsx-design` subagent ran on proposal, specs and this design: no BLOCKING findings. Its warnings were settled in this design:
- *`repick` went through an idle gap when the item on screen was unpicked:* the new queue is now appended first and the current entry removed after, and `resumeAt` is reused instead of a new `startAt`.
- *`repick` with nothing on screen was undefined:* it now just runs `keepPlaying` and updates `idle`.
- *`togglePick` placement:* it goes in the DOM-free script block the page test runs in `vm`.
- *`picks` not fully kept:* `show()` refuses `picks/…`; the choices' shape is given.

Implementation review (`review-orchestrator`, Architecture, Testing, Performance, Style): no BLOCKING findings. Warnings fixed: a failure telling the player is logged instead of failing the save, upload or removal; the page's saves are serialised, adopt the box's answer and reload on focus or failure; `repick` reads mpv's playlist afresh before each removal; unit tests assert `picksChanged`, and cover a broken `picks.json`, mixed good and bad picks, more unpickable paths, unpicking the last pick, unpicking everything, picking while black, and another playlist playing. Accepted as they are: `repick` setting the playlist's `lastQueued`/`resumeAt` from `player.js`, and `pickableItems` walking the folders the way `choices()` does (a shared walk is a refactor for later).

Design-review suggestions taken: the absolute/relative path note, the full expected playlist in the unpicking scenario, and the refusal scenario as four requests. The two renamed override-website tests are in tasks 1.3.
