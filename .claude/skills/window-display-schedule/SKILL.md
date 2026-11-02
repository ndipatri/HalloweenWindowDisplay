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

Changes to how the display behaves (seasons, schedule, overrides, sync, installer, what `show` and the log report) go through OpenSpec with this repo's `window-display` schema (`openspec/schemas/window-display/`, CLI 1.14.1: `npm install -g @fission-ai/openspec@1.14.1`). Start with the agentic-coding plugin's `openspec-propose` or `openspec-new-change` skill. Every scenario in a spec is enforced by a test with exactly its name in `scheduler/tests/*.test.js`: `node openspec/check-scenarios.js` lists any scenario without one, and `scheduler/tests/specs.test.js` runs that check over `openspec/specs/` with the other tests. A one-line config tweak the person has asked for can skip OpenSpec, but it still needs a pinned test (step 4). The steps below apply either way.

1. **Pin down the intent in dates.** Turn the request into the exact days and times it should produce, and state them back. Example: "Thanksgiving: Fri/Sat until Thanksgiving, then the day before and the day" means Nov 6, 7, 13, 14, 20, 21, 25 and 26 in 2026, and other November days are black. Check what nearby seasons and the schedule do on the edge days. Point out side effects, such as the 5–7 am kid period also playing on those days.
2. **Branch from `origin/main`** and edit `CONFIG`. Keep the explanatory comments above each list accurate, and add a one-line comment on any non-obvious entry.
3. **Videos:** a new season needs `playlists/<name>/`, plus subfolders if wanted. A season with no folder yet is fine (black, logged once, not an error). Update `playlists/README.md` if the folder rules change.
4. **Test:** `for f in scheduler/tests/*.test.js; do node "$f" || exit 1; done` (Node, no Mac needed; macOS parts are faked). Add a test that pins the exact days or periods from step 1, in the style of the Thanksgiving test (a list of covered days for two or three years). If you change the season or schedule logic itself, also test bad entries being skipped and logged. Run `node --check scheduler/video_scheduler.js`. The script runs under JavaScriptCore (JXA), so plain ES2015+ is fine, but no Node APIs.
5. **README:** it is a plain, non-technical guide for the person, so no config syntax, rules or anything else from this skill goes in it. Update only the "What's playing" tables (each season's When in plain words, e.g. "Fridays and Saturdays in November until Thanksgiving, then the day before and Thanksgiving Day itself"; the daily times), and "Using it" / "If something's wrong" if a command the person types changes. Details belong in this skill.
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

## How the Mac side works

- `bash scheduler/install.sh` (never `sudo`) copies the scheduler, `show`, `start` and `sync` into `~/video-scheduler/`, writes the launch agent `~/Library/LaunchAgents/com.user.videoscheduler.plist`, and starts it. It restarts with `launchctl kickstart -k` when the plist is unchanged, otherwise boots out, waits until unloaded, and bootstraps (no sleeps or retries). Overrides survive a reinstall. It warns if the repo is in Desktop, Documents or Downloads (macOS blocks a login agent from reading them), and lists leftover pre-seasons `kid`/`grownup` folders.
- At login `start` syncs (at most every 10 minutes) and then runs the scheduler; launchd restarts it if it crashes.
- `~/video-scheduler/sync` runs `git pull` (60 s watchdog; on failure it uses the repo as it is) and then mirrors each folder under `playlists/`: copies new or changed videos in under a hidden name and renames them into place, and moves videos (or whole subfolders) no longer in the repo to `~/video-scheduler/.removed/`. It never deletes. Top-level folders not in the repo are left alone (a local-only season works). Once a season folder exists in the repo, it is the master copy for that season.
- Playback: `.mp4`, `.m4v`, `.mov`; name order with numbers sorted as numbers (a `1-`, `2-` prefix sets the order); folders are re-read as the queue moves on, so no restart is needed for video changes; each playlist resumes where it left off; a single video loops; a damaged file is skipped and logged. GitHub refuses files over 100 MB.
- Files in `~/video-scheduler/`: `scheduler.log` (what's showing and why on every change, each video as it starts, overrides, problems), `status` (one line, what `show` prints), `override.json` (only while an override is on), `.removed/`.
- Log lines look like `Now showing: halloween/kid (scheduled until 7:30 PM)`, `halloween/kid: playing fuzzy_creatures.mp4`, `black (outside schedule until 5:00 PM)`, `black (no season today, Jan 15)`.
- launchd: restart `launchctl kickstart -k gui/$(id -u)/com.user.videoscheduler`; stop `launchctl bootout gui/$(id -u)/com.user.videoscheduler` (back at next login); inspect `launchctl print gui/$(id -u)/com.user.videoscheduler`; remove for good: stop it, then delete the plist. Control-C on the display quits until the next login.
- macOS settings it relies on: display rotated to portrait (it only uses a display taller than wide), automatic login (not available with FileVault on), Do Not Disturb on a schedule, no automatic macOS updates. The TV's auto power-off must be off.

## Previewing and overriding

- `show <season> 10` plays a season's own videos for 10 minutes. `show <season>/<playlist> 10` adds its subfolder.
- `show grownup 30` and `show off` override until the time is up or the schedule changes. `--until-cleared` holds it. `show schedule` cancels.
- On a day with no season, a plain playlist (`show kid`) is black, so name the season.
- An override with no time lasts until the schedule next changes (outside the schedule, until the next period starts); overrides end by themselves so the scary videos can't be left on in the morning. `show` warns about a name that matches no folder. `show` is `~/video-scheduler/show`; the README gives the alias line for `~/.zshrc`.

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
| `No videos for …` | The season (and its subfolder) has no playable files yet |
| `Skipping …` | Damaged or unplayable file; re-export as H.264 MP4 |
| A video vanished from the Mac | Not in the repo, so sync moved it to `.removed/`; add it to the repo |
| `Ignoring …/override.json` | Hand-edited, malformed override; `show schedule` deletes it |
| Mac desktop shows, no video | Display not portrait, or agent not running (`launchctl print …`) |
| Black but log says `playing …` | TV input/brightness, or the curtain is too thick |

Add new failures to this table. Only add a row to the README's "If something's wrong" if the person can fix it with a plain step.