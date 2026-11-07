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

Changes to how the display behaves (seasons, schedule, overrides, the website, sync, setup, what the status and the log report) go through OpenSpec with this repo's `window-display` schema (`openspec/schemas/window-display/`, CLI 1.14.1: `npm install -g @fission-ai/openspec@1.14.1`). Start with the agentic-coding plugin's `openspec-propose` or `openspec-new-change` skill. Every scenario in a spec is enforced by a test with exactly its name in `scheduler/tests/*.test.js`: `node openspec/check-scenarios.js` lists any scenario without one, and `scheduler/tests/specs.test.js` runs that check over `openspec/specs/` with the other tests. Two reviews are part of every change with a design.md: the agentic-coding plugin's `review-opsx-design`, as a read-only subagent once design.md is written, with every BLOCKING finding settled with the person before tasks; and `review-orchestrator` on the whole change as the last verification task, repeated until no BLOCKING findings remain. Both are told the project is Node, bash, mpv and systemd, not Dart or Python (the schema has the wording). A one-line config tweak the person has asked for can skip OpenSpec, but it still needs a pinned test (step 4). The steps below apply either way.

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

Video-only changes (adding or removing files in `playlists/`) need nothing: the box syncs a minute after boot and then hourly. To sync now: **Sync now** on the website (or `sudo systemctl start tvbox-sync.service`).

If the box shows the wrong season, check first whether setup was rerun after the change.

## How the box works

- `sudo bash scheduler/setup.sh` (run from the person's user, so `SUDO_USER` is them; safe to rerun):
  - installs `mpv`, `nodejs`, `git` and `logrotate` with apt;
  - creates the `video` and `render` groups if missing (tvbox.service asks for both, and systemd won't start it without them), and adds the user to them;
  - sets the time zone (`TVBOX_TIMEZONE`, default America/New_York) and turns on network time;
  - copies `config.js`, `logic.js`, `mpv.js`, `player.js` and `website.js` to `/opt/tvbox`;
  - writes `~/video-scheduler/sync` with the repo path;
  - makes `~/video-scheduler/photos/` and settles the upload PIN, before installing anything: `TVBOX_UPLOAD_PIN` (4–8 digits, else it exits 1 with `The upload PIN must be 4 to 8 digits.`) sets or changes it; otherwise a saved `upload-pin` is kept; otherwise, with a terminal (`[ -t 0 ]`), it asks with `read -rs`; otherwise (a card's first boot) it prints `No upload PIN set, so adding photos is off. …` and uploads stay off. The file is written mode 600. To set or change it later: `sudo TVBOX_UPLOAD_PIN=1234 bash scheduler/setup.sh` (`sudo` drops other environment variables, so give it inside the sudo command);
  - installs `/etc/logrotate.d/tvbox` from `scheduler/logrotate/tvbox` (see Files below);
  - installs `tvbox.service`, `tvbox-sync.service` and `tvbox-sync.timer` from `scheduler/systemd/`;
  - syncs once, then restarts the player.

  For a dry run, set `TVBOX_ROOT` (a folder standing in for /), `TVBOX_USER` and `TVBOX_HOME`, with fake `apt-get`, `systemctl`, `timedatectl`, `usermod`, `groupadd` and `getent` first on `PATH` and stdin from `/dev/null`; `scheduler/tests/setup.test.js` does this. The rehearsal (below) runs it for real.
- `tvbox.service` runs `node /opt/tvbox/player.js` as the user. The player:
  - starts mpv (`--vo=gpu --gpu-context=drm`, straight to the TV, black when idle, `--video-rotate` from config; `--hwdec=drm --hwdec-codecs=hevc`, so HEVC decodes in hardware and every other codec in software without probing; photos for `photoSeconds` each with `--image-display-duration`, fitted on black with `--keepaspect=yes --panscan=0 --background=color --background-color=#000000`), talks to it over `/run/tvbox/mpv.sock`, and serves the website on port 80 (`CAP_NET_BIND_SERVICE`);
  - every second works out what to show (`whatToShow`), writes the status file, and keeps mpv's queue three videos ahead (`keepPlaying`);
  - if mpv exits, exits with code 1, and systemd (`Restart=always`) starts both again.

  Both services append to `~/video-scheduler/scheduler.log`.
- **Black until the clock is set:** until `/run/systemd/timesync/synchronized` exists (systemd-timesyncd creates it once the time comes from the network), the status is `black (waiting for the clock to be set)`.
- **Sync** is `scheduler/sync_videos.sh`: `git pull` under `timeout` (60 s; on failure it uses the repo as it is, and it leaves nothing running), then mirrors each folder under `playlists/`. It copies new or changed videos in under a hidden name and renames them into place, and moves videos (or whole subfolders) no longer in the repo to `~/video-scheduler/.removed/`. It never deletes. Top-level folders not in the repo are left alone. `photos` is skipped in both of its loops, even if the repo has `playlists/photos` (then it logs `Skipping playlists/photos: that name is kept for uploads from the website.` once per sync). Once a season folder exists in the repo, it is the master copy for that season. One sync runs at a time: it holds `flock` on `~/video-scheduler/.sync.lock`, and a sync that starts meanwhile (the timer and Sync now overlapping) logs `Skipped: another sync is already running.` and exits 0.
- **Playback:**
  - `.mp4`, `.m4v`, `.mov`, in name order with numbers sorted as numbers (a `1-`, `2-` prefix sets the order);
  - photos (`.jpg`, `.jpeg`, `.png`, `config.photoExtensions`) play only in `photos`, never in a season folder;
  - folders are re-read as the queue moves on, so no restart is needed for video changes;
  - a playlist that comes back starts again at the video it was on;
  - a single video loops;
  - a file mpv can't play is skipped and logged once.

  GitHub refuses files over 100 MB. The Pi 5 decodes H.264 in software (fine at 1080p 24 fps) and HEVC in hardware (`--hwdec=drm`); if a repo video stutters, re-encode it to HEVC.
- **Photos (uploads):** `photos` is a kept name. `resolve('photos')` is `photos` whatever the season (with or without seasons), playing only `~/video-scheduler/photos/`, so it plays only as an override from the website's All uploads button. A season named `photos` or a schedule period playing `photos` is ignored with an `ERROR: Ignoring …` line saying why. Uploads are named `NNNNN-<cleaned name>` (one above the highest number ever given, kept in the hidden `photos/.last-number`), so name order is upload order and numbers are never reused, even after the newest is removed. Leftover `.upload-*` part files from a restart mid-upload are removed when the website starts. With no uploads (or no folder) the screen is black and `No photos or videos uploaded yet. Showing black until one is added.` is logged once. Removing an upload on the website first takes it out of mpv's playlist (`player.dropFile`, serialised with the tick), so mpv moves on without an error.
- **My picks:** `picks` is a kept name too (a season or schedule entry `picks` is ignored with an `ERROR: Ignoring …` line, a `picks` folder is never a preview, and `POST /api/show` refuses `picks/…`). The picks are `~/video-scheduler/picks.json` (`{"picks": ["thanksgiving/dusk.mp4", "photos/00001-a.jpg"]}`, paths relative to the video folder). `logic.pickable(path)` decides what can be picked: a video (not a photo) in a top folder or one of its subfolders, or a photo or video directly in `photos/`, that is on the box now. `resolve('picks')` is `picks` whatever the season; its playlist is `ordered`: items play in the file's order (by position, not name), round and round, and `resumeAt` goes by path. A pick no longer on the box (sync moved it to `.removed/`) is skipped with `Skipping <path> in picks: it is no longer on the box.` once; none at all is black with `Nothing picked yet. Showing black until something is ticked in My picks.` once. A new upload is appended to the picks and a removed one taken out. When the picks are saved while they play, `player.repick` (serialised with the tick, passed to the website as `picksChanged`) clears mpv's queue behind the item on screen and refills it from the new picks; if the item on screen was unpicked, the next pick is queued first and then the item removed, so mpv moves straight on without going black.
- **Files in `~/video-scheduler/`:** `scheduler.log` (what's showing and why on every change, each video as it starts, overrides, sync, uploads and removals, problems), `status` (one line, what the website shows), `override.json` (only while an override is on), `.removed/`, `photos/` (the uploads; `.upload-*` while one arrives), `upload-pin` (mode 600), `picks.json` (My picks, written by the website).
  `scheduler.log` is rotated by logrotate (Raspberry Pi OS runs it daily): weekly, or sooner past 5 MB, keeping four old logs (`scheduler.log.1`, then compressed `.2.gz` to `.4.gz`). It uses `copytruncate` because the services keep the log open; without it, they would go on writing into the rotated file (the rehearsal checks this).
- **systemd:**
  - restart: `sudo systemctl restart tvbox`;
  - stop until next boot: `sudo systemctl stop tvbox`;
  - status: `systemctl status tvbox tvbox-sync.timer`;
  - mpv's own errors: in the log, or `journalctl -u tvbox`.

## Making cards (new boxes)

`node cards/make-cards.js`, on the person's Mac, makes SD cards that become working boxes when plugged in.

**What it does:**
- asks once for the Wi‑Fi (name, password, country), the user and password, the time zone, an SSH key from `~/.ssh` (optional), and the repo;
- downloads the latest Raspberry Pi OS Lite (64-bit) from `downloads.raspberrypi.com/raspios_lite_arm64_latest` and checks it against its published `.sha256`, keeping it in `~/Library/Caches/tvbox`;
- for each card:
  - asks the name (`tvbox`, `tvbox2`, …);
  - lists only whole, physical, 4–256 GB disks that are external, or a card in a MacBook's built-in SD slot (reported as internal, removable, `Secure Digital`), and never the start-up disk. On APFS, that's the synthesized container plus its physical stores' disks, from `diskutil apfs list` (`bootWholeDisks`). It uses `diskutil list physical` + `plutil`, filtered by `pickCards`;
  - requires the disk's identifier typed back;
  - unpacks the image with `xz` (or `python3`'s lzma) into `sudo dd of=/dev/rdiskN bs=4m`;
  - mounts `bootfs`, writes the three cloud-init files, and ejects.

**The cloud-init files** (`cards/cloud-init.js`, read by Raspberry Pi OS from the boot partition on first boot):
- `user-data`:
  - the hostname and time zone;
  - the user, in Imager's 15 groups, with the password as a SHA-512 crypt hash only;
  - `enable_ssh`, and `ssh_pwauth: true`;
  - `write_files`: `/etc/tvbox/firstboot.conf`, `/usr/local/sbin/tvbox-firstboot` (`cards/firstboot.sh`) and `tvbox-firstboot.service`;
  - `runcmd` enabling and starting that service with `--no-block`.
- `network-config`: netplan v2 through NetworkManager, with `wlan0` (Wi‑Fi, `regulatory-domain`) and `eth0`, both optional.
- `meta-data`: `dsmode: local` and a fresh `instance_id`.

**First boot:** `tvbox-firstboot.service` runs the script until it succeeds: it retries every minute, across reboots, until `/var/lib/tvbox/firstboot-done` exists. The script:
- waits for the repo's host;
- installs git (Lite doesn't have it);
- clones the repo as the user;
- runs `SUDO_USER=<user> bash scheduler/setup.sh`.

It logs to `/var/log/tvbox-firstboot.log`.

**Testing without a Mac or a card:** `node cards/make-cards.js --to-file card.img --answers answers.json [--image raspios.img.xz]` writes a finished card image on Linux (mtools), from a JSON of the answers (it holds a password, so keep it out of the repo). Read the files back with `mtype -i card.img@@<offset> ::/user-data`. The rehearsal checks the files with `cloud-init schema`, applies their `write_files`, and runs the first-boot script for real.

What only a real Mac and Pi show:
- `diskutil`'s fields on the person's macOS (if `VirtualOrPhysical` or `Internal` were missing, no disk would be offered, which fails safe);
- the write itself;
- the Pi joining the Wi‑Fi.

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

## Trying it without the box (the emulator)

`bash scheduler/tests/e2e/emulate.sh` runs a box on the Mac, in the rehearsal's Docker image, until Ctrl-C. Use it when the person is away from the real box, or to try a website or player change by hand before shipping.
- **What runs:** a copy of this folder as it is (uncommitted changes included), the real `setup.sh` (upload PIN `1234`, or `TVBOX_EMULATOR_PIN`), sync of the real videos from `playlists/`, the player and mpv. Sync pulls from this folder's current branch (`origin` points at `/src`), never from GitHub.
- **Where:**
  - the website: http://localhost:8080/ (from a phone on the same Wi‑Fi: the Mac's name, port 8080);
  - the "TV": http://localhost:8081/ (`emulator/tv.js`), showing the newest frame and the status line.
- **How the TV works:** `emulator/mpv` wraps mpv with `--vo=null` and saves a JPEG of the picture twice a second to `/tmp/tv`, keeping only the newest few. The page turns the frame back by `rotate`, as the TV standing on its side does, and shows black when no frame is from the last two seconds.
- **The clock** is the Mac's, in `TVBOX_TIMEZONE` (default America/New_York). So the schedule and seasons are today's, and overrides from the website are the way to see other playlists.
- **Building:** if the image can't be rebuilt (Docker Desktop offline from Docker Hub), it uses the one built before.
- **Nothing is kept:** uploads, picks and the log go when it stops.
- **What it can't show:** smooth motion, sound, and the real TV's colours.

## The website (overrides)

The player serves it at http://tvbox.local/ (`scheduler/website.js`). It writes `~/video-scheduler/override.json` in the same format `show` wrote, so the override rules are unchanged:

- **Choices:**
  - each playlist named in the schedule (kid, grownup);
  - My picks (`picks: true` in the choices; plays `picks`);
  - All uploads (the uploads; `photos: true` in the choices; plays `photos`);
  - Black;
  - a preview of any season folder or season/playlist folder on the box other than `photos` and `picks`;
  - Back to schedule.
- **Durations:** until the schedule changes, 15, 30 or 60 minutes, or until switched back (`untilCleared`). The page starts on until switched back (the person's choice); `POST /api/show` without `until` still lasts until the schedule changes.
- **API:** `GET /api/status`, `GET /api/choices`, `POST /api/show {target, until: 'schedule'|'cleared'|minutes}`, `POST /api/schedule`, `POST /api/sync` (runs `~/video-scheduler/sync` with output appended to the log; answers at once, or `A sync is already running.`), `GET /api/log` (`{lines}`: the last 20 non-empty lines, read from the last 16 KB).
- **Sync now and Recent activity** are on the page. The activity list refreshes with the status every few seconds.
- An override with no time lasts until the schedule next changes (outside the schedule, until the next period starts). Overrides with a time end by themselves; one until switched back (the page's default) stays until Back to schedule, so a forgotten grownup choice plays on into the morning. On a day with no season, a plain playlist is black, so preview the season instead.
- **Uploads** (Add photos or videos): the page checks the whole batch first, then sends each file as one raw POST (`XMLHttpRequest`, for progress), stopping at the first refusal; a wrong PIN or a lock forgets the PIN kept in `localStorage`. The batch flow is `sendBatch` in its own `<script>` block, so the tests run it in `vm`. Each file streams into `photos/.upload-<random>` and is linked to its numbered name only when every byte has arrived; one that stops partway is deleted and logged. Limits come from `config.uploads`: at most 1 GB a file, 2 GB must stay free (`fs.statfsSync`), 5 wrong PINs in a row (uploads, checks and removals together) lock for 5 minutes (in memory; a restart clears it). The server has no overall request timeout (`requestTimeout: 0`) and closes a connection idle for 2 minutes.

  | Route | Request | Success | Refusals |
  |---|---|---|---|
  | `GET /api/uploads` | – | `{ pinSet, uploads: [{ name, kind: 'photo'\|'video', bytes }] }` in play order | – |
  | `POST /api/uploads/check` | header `X-Upload-Pin`; `{ files: [{ name, bytes }] }` | `Ready to add N files.` | 403 `Wrong PIN.` / `Adding photos is off…`; 429 `Too many wrong PINs…`; 400 type; 413 too big; 507 no room |
  | `POST /api/uploads?name=…` | header `X-Upload-Pin`, `Content-Length`; the file as the body | `Added <name>.` | as check; 400 `Bad request.` |
  | `POST /api/uploads/remove` | header `X-Upload-Pin`; `{ name }` | `Removed <name>.` | 403, 429; 404 `No upload named <name>.` |
  | `GET /photos/<name>` | optional `Range` | 200 or 206, cacheable for a year | 404 `Not found.`; 416 |
- **My picks** on the page lists `GET /api/picks` (`{ items: [{ path, group }], picks: [path] }`: season folders and subfolders in name order, then `Uploads`; picks no longer on the box left out) with a tick box per item, numbered in pick order. Each tick or untick runs `togglePick` (in the same DOM-free `<script>` block as `sendBatch`, so tests run it in `vm`) and posts the whole list to `POST /api/picks {picks}`: every entry must be `pickable` (else 400 `Can't pick <path>.` and nothing saved), duplicates are dropped, and it answers `Saved. N picked.` / `Saved. Nothing picked.` and logs `My picks: N picked (from the website).`.
- Only adding and removing photos need a PIN; everything else has no password, as the website is only reachable on the home network.

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
| `ERROR: Skipping …` | Damaged or unplayable file; re-export as H.264 MP4. For an uploaded photo, it may be too large for the GPU (48 MP and up): shrink it and add it again |
| `Cannot load libcuda.so.1` / `Failed setup for format vulkan` on every video | mpv probing hardware decoders the Pi 5 doesn't have for H.264: the box runs code from before `--hwdec-codecs=hevc`; rerun setup. Harmless, as playback falls back to software |
| An uploaded HEVC video stutters, or its colours look washed out | iPhone 4K HDR (10-bit) video. Try `--hwdec=drm-copy` in `mpv.js`; or on the phone turn off HDR video, or share at 1080p |
| Website: `Adding photos is off: no upload PIN is set on the box.` | No valid `~/video-scheduler/upload-pin` (a card's unattended first boot sets none): `sudo TVBOX_UPLOAD_PIN=1234 bash scheduler/setup.sh` |
| `Five wrong upload PINs in a row: uploads locked until …` | Someone typed the PIN wrong five times; it unlocks by itself after five minutes (or on a restart) |
| `No photos or videos uploaded yet` | All uploads chosen with nothing uploaded: add some on the website |
| `Nothing picked yet` | My picks chosen with nothing ticked: tick something under My picks |
| `Skipping … in picks: it is no longer on the box.` | A picked video left the repo (sync moved it to `.removed/`); it drops out of the list, and out of `picks.json` on the next save |
| A video vanished from the box | Not in the repo, so sync moved it to `.removed/`; add it to the repo |
| `Ignoring …/override.json` | Malformed override; Back to schedule deletes it |
| Picture upside down or sideways | `rotate` in config.js (90 ↔ 270), then rerun setup |
| Black but log says `playing …` | TV input/brightness, or the curtain is too thick |

Add new failures to this table. Only add a row to the README's "If something's wrong" if the person can fix it with a plain step.
