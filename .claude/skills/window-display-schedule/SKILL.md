---
name: "window-display-schedule"
description: "Add or change a season, playlist or daily schedule for the HalloweenWindowDisplay scheduler, test it, ship it, and make sure the Raspberry Pi box actually picks it up."
---

# Window display schedule

For ndipatri/HalloweenWindowDisplay: a Raspberry Pi box ("the box") plugged into a portrait TV plays videos from `~/video-scheduler/<season>/` through mpv. A Node player (`scheduler/player.js`, run by systemd as `tvbox.service`) decides what plays, using the logic in `scheduler/logic.js` and the settings in `scheduler/config.js`, and serves a website for overrides. Videos come from the repo's `playlists/` via `~/video-scheduler/sync`, run hourly by `tvbox-sync.timer`. The Mac version is kept only at the git tag `mac-legacy`. Use this skill for any change to *what plays when*. For making a new video, use the window-display-video skill.

## How the config fits together

Both lists are in `scheduler/config.js`, which also has the box settings (`box`: video folder, `rotate`, `webPort`, `clockFile`, `mpvSocket`).

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

Changes to how the display behaves (seasons, schedule, overrides, the website, sync, setup, what the status and the log report) go through OpenSpec with this repo's `window-display` schema (`openspec/schemas/window-display/`, CLI 1.14.1: `npm install -g @fission-ai/openspec@1.14.1`). Start with the agentic-coding plugin's `openspec-propose` or `openspec-new-change` skill. Every scenario in a spec is enforced by a test with exactly its name in `scheduler/tests/*.test.js`: `node openspec/check-scenarios.js` lists any scenario without one, and `scheduler/tests/specs.test.js` runs that check over `openspec/specs/` with the other tests. A one-line config tweak the person has asked for can skip OpenSpec, but it still needs a pinned test (step 4). The steps below apply either way.

1. **Pin down the intent in dates.** Turn the request into the exact days and times it should produce, and state them back. Example: "Thanksgiving: Fri/Sat until Thanksgiving, then the day before and the day" means Nov 6, 7, 13, 14, 20, 21, 25 and 26 in 2026, and other November days are black. Check what nearby seasons and the schedule do on the edge days. Point out side effects, such as the 5–7 am kid period also playing on those days.
2. **Branch from `origin/main`** and edit `CONFIG`. Keep the explanatory comments above each list accurate, and add a one-line comment on any non-obvious entry.
3. **Videos:** a new season needs `playlists/<name>/`, plus subfolders if wanted. A season with no folder yet is fine (black, logged once, not an error). Update `playlists/README.md` if the folder rules change.
4. **Test:** `for f in scheduler/tests/*.test.js; do node "$f" || exit 1; done` (Node; mpv, the clock and files are faked). Add a test that pins the exact days or periods from step 1, in the style of the Thanksgiving test (a list of covered days for two or three years). If you change the season or schedule logic itself, also test bad entries being skipped and logged. Run `node --check` on each changed `.js` file. The box runs the Node from Raspberry Pi OS's apt (18 or later) with no npm packages, so use only built-in modules. If the change touches `setup.sh`, sync, the systemd units, `player.js`, `mpv.js` or `website.js`, also run the rehearsal on the box's OS (see "Rehearsing on the box's OS" below).
5. **README:** it is a plain, non-technical guide for the person, so no config syntax, rules or anything else from this skill goes in it. Update only the "What's playing" tables (each season's When in plain words, e.g. "Fridays and Saturdays in November until Thanksgiving, then the day before and Thanksgiving Day itself"; the daily times), and "Using it" / "If something's wrong" if something the person does changes. Details belong in this skill.
6. **Ship:** commit, push, and open a PR with `gh api repos/ndipatri/HalloweenWindowDisplay/pulls -f title=… -f head=<branch> -f base=main -F body=@file` (GraphQL is blocked in cloud sessions, so no `gh pr create`). Merge only when asked: `gh api -X PUT repos/ndipatri/HalloweenWindowDisplay/pulls/<n>/merge -f merge_method=merge`. A cloud session can't push tags or create releases; from the shell on the person's Mac, run git and gh through `.git/tools/gh-run git …` / `.git/tools/gh-run gh …`, which signs in with the repo-only token in `.git/credentials` and waits out that shell's flaky DNS.

## Getting it onto the box (the step that gets missed)

A change under `scheduler/` does nothing until setup is rerun on the box, because setup copies the code to `/opt/tvbox` (so the hourly `git pull` can't change running code). Always end by telling the person to run, after merging:

```sh
ssh tvbox.local
cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh
```

Then check it took:
- The website (http://tvbox.local/) shows what's on screen and why, e.g. `thanksgiving/grownup (scheduled until 11:00 PM)` or `black (no season today, Nov 2)`.
- `tail ~/video-scheduler/scheduler.log` shows `Started.` and a `Seasons:` line listing the new rules.

Video-only changes (adding or removing files in `playlists/`) need nothing: the box syncs a minute after boot and then hourly. To sync now: `sudo systemctl start tvbox-sync.service`.

If the box shows the wrong season, check first whether setup was rerun after the change.

## How the box works

- `sudo bash scheduler/setup.sh` (run from the person's user, so `SUDO_USER` is them; safe to rerun):
  - installs `mpv`, `nodejs` and `git` with apt;
  - creates the `video` and `render` groups if missing (tvbox.service asks for both, and systemd won't start it without them), and adds the user to them;
  - sets the time zone (`TVBOX_TIMEZONE`, default America/New_York) and turns on network time;
  - copies `config.js`, `logic.js`, `mpv.js`, `player.js` and `website.js` to `/opt/tvbox`;
  - writes `~/video-scheduler/sync` with the repo path;
  - installs `tvbox.service`, `tvbox-sync.service` and `tvbox-sync.timer` from `scheduler/systemd/`;
  - syncs once, then restarts the player.

  For a dry run, set `TVBOX_ROOT` (a folder standing in for /), `TVBOX_USER` and `TVBOX_HOME`, with fake `apt-get`, `systemctl`, `timedatectl`, `usermod` and `groupadd` first on `PATH`. The rehearsal (below) runs it for real.
- `tvbox.service` runs `node /opt/tvbox/player.js` as the user. The player:
  - starts mpv (`--vo=gpu --gpu-context=drm`, straight to the TV, black when idle, `--video-rotate` from config), talks to it over `/run/tvbox/mpv.sock`, and serves the website on port 80 (`CAP_NET_BIND_SERVICE`);
  - every second works out what to show (`whatToShow`), writes the status file, and keeps mpv's queue three videos ahead (`keepPlaying`);
  - if mpv exits, exits with code 1, and systemd (`Restart=always`) starts both again.

  Both services append to `~/video-scheduler/scheduler.log`.
- **Black until the clock is set:** until `/run/systemd/timesync/synchronized` exists (systemd-timesyncd creates it once the time comes from the network), the status is `black (waiting for the clock to be set)`.
- **Sync** is `scheduler/sync_videos.sh`: `git pull` under `timeout` (60 s; on failure it uses the repo as it is, and it leaves nothing running), then mirrors each folder under `playlists/`. It copies new or changed videos in under a hidden name and renames them into place, and moves videos (or whole subfolders) no longer in the repo to `~/video-scheduler/.removed/`. It never deletes. Top-level folders not in the repo are left alone. Once a season folder exists in the repo, it is the master copy for that season.
- **Playback:**
  - `.mp4`, `.m4v`, `.mov`, in name order with numbers sorted as numbers (a `1-`, `2-` prefix sets the order);
  - folders are re-read as the queue moves on, so no restart is needed for video changes;
  - a playlist that comes back starts again at the video it was on;
  - a single video loops;
  - a file mpv can't play is skipped and logged once.

  GitHub refuses files over 100 MB. The Pi 5 decodes H.264 in software (fine at 1080p 24 fps); if playback stutters, re-encode to HEVC, which it decodes in hardware.
- **Files in `~/video-scheduler/`:** `scheduler.log` (what's showing and why on every change, each video as it starts, overrides, sync, problems), `status` (one line, what the website shows), `override.json` (only while an override is on), `.removed/`.
- **systemd:**
  - restart: `sudo systemctl restart tvbox`;
  - stop until next boot: `sudo systemctl stop tvbox`;
  - status: `systemctl status tvbox tvbox-sync.timer`;
  - mpv's own errors: in the log, or `journalctl -u tvbox`.

## Rehearsing on the box's OS

`bash scheduler/tests/e2e/box.e2e.sh` rehearses the box end to end without a Pi:
- **The environment:** Docker builds the box's OS, Debian 13 (trixie) on arm64 with the Raspberry Pi archive and its keyring package, the way Raspberry Pi OS Lite has them (`scheduler/tests/e2e/Dockerfile`).
- **What it does:** `scheduler/tests/e2e/inside.sh` plays the person:
  - clones the repo with small test clips in place of the videos;
  - runs the real `sudo bash scheduler/setup.sh` (real apt; fake `systemctl` and `timedatectl`, since there's no systemd in a container);
  - starts the player as the service would;
  - uses the website;
  - kills mpv.
- **What it checks:**
  - setup's result, and `systemd-analyze verify` on the units;
  - the first sync;
  - the status, the log, and mpv's frames (drawn to PNGs by `fakes/mpv`, which wraps the real mpv), including their 90° rotation and colour;
  - the broken clip skipped once;
  - black, back to schedule;
  - the player exiting with code 1 when mpv stops.

It prints `PASS`/`FAIL` per check and ends with `N passed, 0 failed`.

Needs: Docker (in a cloud session, `dockerd > /tmp/dockerd.log 2>&1 &` first). On an Intel machine it turns on arm64 emulation with `tonistiigi/binfmt` (needs `--privileged`). It's slow: the first image build installs packages under emulation (10+ minutes), and later runs take a few minutes. `TVBOX_E2E_PLATFORM=linux/amd64` skips emulation: faster, but not the box's CPU.

Add a check to `inside.sh` for any new box behaviour it can reach: a website action, a log line, a file setup writes. It can't check the TV picture, full-size playback speed, mpv's output straight to the screen, booting, or Wi‑Fi: those stay on-the-box checks.

The box's software today: Raspberry Pi OS Lite (64-bit), Debian 13 (trixie), Node.js 20.19, mpv 0.40, and ffmpeg 7.1 from the Raspberry Pi archive. When Raspberry Pi OS moves to a new Debian release, update the Dockerfile's `FROM` and the keyring package, and rerun the rehearsal.

## The website (overrides)

The player serves it at http://tvbox.local/ (`scheduler/website.js`). It writes `~/video-scheduler/override.json` in the same format `show` wrote, so the override rules are unchanged:

- **Choices:**
  - each playlist named in the schedule (kid, grownup);
  - Black;
  - a preview of any season folder or season/playlist folder on the box;
  - Back to schedule.
- **Durations:** until the schedule changes, 15, 30 or 60 minutes, or until switched back (`untilCleared`).
- **API:** `GET /api/status`, `GET /api/choices`, `POST /api/show {target, until: 'schedule'|'cleared'|minutes}`, `POST /api/schedule`.
- An override with no time lasts until the schedule next changes (outside the schedule, until the next period starts). Overrides end by themselves, so the scary videos can't be left on in the morning. On a day with no season, a plain playlist is black, so preview the season instead.
- There is no password: it's only reachable on the home network.

## Troubleshooting the box

| Symptom | Cause / fix |
|---|---|
| Wrong season, or old rules in the `Seasons:` log line | Setup not rerun: `git pull && sudo bash scheduler/setup.sh` |
| `black (waiting for the clock to be set)` | No network time yet: Wi‑Fi down, or timesyncd off (`timedatectl`) |
| `black (no season today, …)` | Expected on days no season covers; otherwise check `days`/`alsoOn`/dates |
| `No folder …, so showing black` | The season folder isn't on the box: not in the repo, a name mismatch, or not synced yet (`sudo systemctl start tvbox-sync.service`) |
| `Ignoring season entry` / `Ignoring schedule entry` | Malformed entry; the log says which field is wrong |
| Screen not following the schedule | An override is in force: the website's Back to schedule |
| `Couldn't pull from GitHub` | Box offline; it plays what it has. Syncs again within the hour |
| Website: `The box has not started yet` | No status file: the player isn't running (`systemctl status tvbox`, then the log) |
| `ERROR: mpv stopped` repeating | mpv can't open the screen: TV not connected at boot, or the user not in `video`/`render` (rerun setup, then reboot) |
| `Website on port 80: … EADDRINUSE` | Something else has port 80: change `webPort` in config.js |
| `No videos for …` | The season (and its subfolder) has no playable files yet |
| `ERROR: Skipping …` | Damaged or unplayable file; re-export as H.264 MP4 |
| A video vanished from the box | Not in the repo, so sync moved it to `.removed/`; add it to the repo |
| `Ignoring …/override.json` | Malformed override; Back to schedule deletes it |
| Picture upside down or sideways | `rotate` in config.js (90 ↔ 270), then rerun setup |
| Black but log says `playing …` | TV input/brightness, or the curtain is too thick |

Add new failures to this table. Only add a row to the README's "If something's wrong" if the person can fix it with a plain step.
