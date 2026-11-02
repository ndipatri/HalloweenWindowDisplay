---
name: "window-display-schedule"
description: "Add or change a season, playlist or daily schedule for the HalloweenWindowDisplay scheduler, test it, ship it, and make sure the Mac actually picks it up."
---

# Window display schedule

For ndipatri/HalloweenWindowDisplay: a JXA scheduler (`scheduler/video_scheduler.js`, run by launchd as `com.user.videoscheduler`) plays videos from `~/video-scheduler/<season>/` on a portrait TV. Videos come from the repo's `playlists/` via `~/video-scheduler/sync`. Use this skill for any change to *what plays when*. For making a new video, use the window-display-video skill.

## How the config fits together

Both lists are in `CONFIG` at the top of `scheduler/video_scheduler.js`.

**`seasons`**: which season folder plays on which days.
- `{ name, from, to }`, with both days inclusive. A season can wrap the new year (`from: '12-15', to: '01-06'`).
- Optional `days: ['fri', 'sat']` (3-letter or full names): only those weekdays within from..to.
- Optional `alsoOn: [...]`: extra days that play whatever the weekday, even outside from..to.
- Ways to write a day:
  - `'MM-DD'`
  - nth or last weekday of a month, so it moves with the year: `'11-4thu'` (Thanksgiving), `'05-lastmon'`
  - either of the above with `+N`/`-N` days: `'11-4thu-1'`
  - in `alsoOn` only, a one-off `'YYYY-MM-DD'`
- The first listed season wins on overlap, so a short special season goes first. On a day no season covers, the screen is black. The season changes at midnight.
- `seasons: []` means no seasons: playlist folders sit directly in `playlists/` and play all year.

**`schedule`**: when the screen is on each day.
- `{ start: 'HH:MM', stop: 'HH:MM', playlist }`, optionally with `days: [...]`. A period that crosses midnight belongs to the day it starts on. The first listed period wins on overlap.
- During a period, today's season folder plays plus its subfolder named after `playlist` if one exists (e.g. `halloween/` + `halloween/grownup/`), sorted together by file name. Subfolders are optional.
- Current schedule: kid 05:00–07:00, kid 17:00–19:30, grownup 19:30–23:00.

To choose which *days* the window is on, use season `days`/`alsoOn`. To choose *times*, or times that differ by weekday, use the schedule.

## Making a change

1. **Pin down the intent in dates.** Turn the request into the exact days and times it should produce, and state them back. Example: "Thanksgiving: Fri/Sat until Thanksgiving, then the day before and the day" means Nov 6, 7, 13, 14, 20, 21, 25 and 26 in 2026, and other November days are black. Check what nearby seasons and the schedule do on the edge days. Point out side effects, such as the 5–7 am kid period also playing on those days.
2. **Branch from `origin/main`** and edit `CONFIG`. Keep the explanatory comments above each list accurate, and add a one-line comment on any non-obvious entry.
3. **Videos:** a new season needs `playlists/<name>/`, plus subfolders if wanted. A season with no folder yet is fine (black, logged once, not an error). Update `playlists/README.md` if the folder rules change.
4. **Test:** `node scheduler/tests/scheduler.test.js` (Node, no Mac needed; macOS parts are faked). Add a test that pins the exact days or periods from step 1, in the style of the Thanksgiving test (a list of covered days for two or three years). If you change the season or schedule logic itself, also test bad entries being skipped and logged. Run `node --check scheduler/video_scheduler.js`. The script runs under JavaScriptCore (JXA), so plain ES2015+ is fine, but no Node APIs.
5. **README:** update the Seasons section (the "Seasons set up today" table, the `seasons:` example, rules), "Set the schedule" if the schedule changed, Day-to-day if commands changed, and the dates beside each season in the `playlists/` tree under Files.
6. **Ship:** commit, push, and open a PR with `gh api repos/ndipatri/HalloweenWindowDisplay/pulls -f title=… -f head=<branch> -f base=main -F body=@file` (GraphQL is blocked, so no `gh pr create`). Merge only when asked: `gh api -X PUT repos/ndipatri/HalloweenWindowDisplay/pulls/<n>/merge -f merge_method=merge`.

## Getting it onto the Mac (the step that gets missed)

A config change does nothing until it's installed. Always end by telling the person to run this on the Mac after merging:

```sh
cd ~/HalloweenWindowDisplay && git pull && bash scheduler/install.sh
```

Then check it took:
- `show` prints what's on screen and why, e.g. `thanksgiving/grownup (scheduled until 11:00 PM)` or `black (no season today, Nov 2)`.
- `cat ~/video-scheduler/scheduler.log` starts with `Started.` and a `Seasons:` line listing the new rules.

Video-only changes (adding or removing files in `playlists/`) don't need the installer: `~/video-scheduler/sync`, or wait for the next login (start syncs at most every 10 minutes).

On Nov 1 Halloween kept playing because the installer hadn't been rerun after the seasons change. If the screen shows the wrong season, check this first.

## Previewing and overriding

- `show <season> 10` plays a season's own videos for 10 minutes. `show <season>/<playlist> 10` adds its subfolder.
- `show grownup 30` and `show off` override until the time is up or the schedule changes. `--until-cleared` holds it. `show schedule` cancels.
- On a day with no season, a plain playlist (`show kid`) is black, so name the season.

## Troubleshooting the Mac

| Symptom | Cause / fix |
|---|---|
| Wrong season, or old rules in the `Seasons:` log line | Installer not rerun: `git pull && bash scheduler/install.sh` |
| `black (no season today, …)` | Expected on days no season covers; otherwise check `days`/`alsoOn`/dates |
| `No folder …, so showing black` | The season folder isn't on the Mac: not in the repo, a name mismatch, or not synced (`~/video-scheduler/sync`) |
| `Ignoring season entry` / `Ignoring schedule entry` | Malformed entry; the log says which field is wrong |
| Screen not following the schedule | An override is in force: `show`, then `show schedule` |
| `Couldn't pull from GitHub` | Mac offline; it plays what it has. Sync again later |
| `No status yet` | Scheduler not running: run the installer |
| `Bootstrap failed: 5` / `still loaded after 10 seconds` | Old installer race / macOS slow to release: rerun the current installer, or log out and in |
| Installer lists leftover `kid`/`grownup` folders | Pre-seasons layout in `~/video-scheduler`; safe to delete once the person is happy |

Keep the README's Troubleshooting table in step when you learn a new failure.