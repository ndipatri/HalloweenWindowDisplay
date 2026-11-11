---
name: "window-display-schedule"
description: "Add or change a season, its videos, tags, or the GitHub filters and their schedules for the HalloweenWindowDisplay box, test it, ship it, and make sure the Raspberry Pi box actually picks it up."
---

# Window display schedule

For ndipatri/HalloweenWindowDisplay: a Raspberry Pi box ("the box") plugged into a portrait TV plays videos from `~/video-scheduler/` through mpv. A Node player (`scheduler/player.js`, run by systemd as `tvbox.service`) decides what plays from the box's **filters** (`~/video-scheduler/filters.json`) over **tags**, using the logic in `scheduler/logic.js`, and serves a website for choosing a filter, tagging items and editing filters. Videos come from the repo's `playlists/` via `~/video-scheduler/sync`, run hourly by `tvbox-sync.timer`. The Mac version is kept only at the git tag `mac-legacy`. Use this skill for any change to *what plays when*. For making a new video, use the window-display-video skill.

## How tags, filters and schedules fit together

**Items and tags** (`logic.items()`):
- Every video in a top folder of `~/video-scheduler/` (other than `photos`) or one of its subfolders is an item with **one folder tag**: its folder path, lowercased, with `/` and anything outside `[a-z0-9-]` turned into `-` (`halloween/kid/x.mp4` → `halloween-kid`, `Easter Eggs/` → `easter-eggs`). Deeper videos, and photo files in repo folders, are not items. A folder whose tag comes out empty or over 30 characters is left out, logged once (`Leaving out …: its name doesn't make a tag …`).
- Every photo or video in `photos/` (the uploads) is tagged `upload`.
- **Box tags** are the box's own, **on uploads only**, in `~/video-scheduler/tags.json` (`{ "tags": { "photos/00001-a.jpg": ["favorites"] } }`), added and removed on the website with no PIN. A video from GitHub has only its folder tag: `/api/tags` refuses it (`<path> comes from GitHub: its tag comes from its folder there.`), `items()` ignores any box tags on it, and saving tags drops them. A tag is 1–30 lowercase letters, digits and dashes. A box tag may repeat a folder tag (tagging a photo `halloween` puts it in the Halloween filters). `favorites` is just a box tag; the page's ☆ toggles it.

**Filters** come from two places, in the same format (`{ "filters": [ … ] }`):
- **GitHub filters**: `playlists/filters.json` in the repo, copied by sync (hourly, and Check for new videos now) to `~/video-scheduler/github-filters.json` when it changes (`Updated the GitHub filters.`; with none in the repo, the copy is removed: `Removed the GitHub filters (the repo has none).`). The same on every box; shown read-only on the website; changed only in the repo, and no setup rerun is needed.
- **Custom filters**: `~/video-scheduler/filters.json`, made, edited, ordered and deleted on that box's website with the upload PIN. They come before the GitHub filters: first among the Play buttons, and they win where times overlap. A custom filter can't take a GitHub filter's name, ignoring case: the website refuses it, and one in the file is skipped (`ERROR: Ignoring filter N (name): GitHub has a filter called …`). The first time the website starts with GitHub filters on the box, custom copies of them (what setup used to copy onto each box) are dropped from `filters.json`, logged `Dropping the custom filter X: GitHub has a filter of that name.`; the hidden `.custom-copies-dropped` marks that it's done, so a custom filter that clashes later is only skipped, never deleted.

- `{ name, anyOf: [tags], except: [tags], schedule: [entries] }`. A filter plays every item with any `anyOf` tag and no `except` tag, sorted by file name with numbers as numbers (then path), round and round. A filter that matches nothing is black, logged once (`Nothing in X yet (any of …). Showing black until something is tagged.`).
- Name: 1–30 letters, digits, spaces, `-` or `'`, unique ignoring case, never `black`, never `(` (the page reads the playing filter back from the status line).
- Entry: `{ from, to, weekdays, also, times: [{ start, stop }] }`, all optional except some days:
  - `from`/`to` (both or neither) are an inclusive range that can wrap the new year;
  - `weekdays` (`['fri', 'sat']`) limits the range;
  - `also` are extra days whatever the weekday, even outside the range;
  - no `times` means all day; a time whose stop is before its start crosses midnight and belongs to the day it starts on.
- Ways to write a day:
  - `'MM-DD'`;
  - nth or last weekday of a month, so it moves with the year: `'11-4thu'` (Thanksgiving), `'05-lastmon'`;
  - either of the above with `+N`/`-N` days: `'11-4thu-1'`;
  - in `also` only, a one-off `'YYYY-MM-DD'`.
- Where two filters' entries overlap, the one higher in the list wins. Outside every entry the window is black (`black (nothing scheduled until 5:00 PM)`). A filter with no entries is refused (`a filter needs days and times; to play tags any time, pick them under Play`): tags play any time from Play.
- Both files are read again whenever they change (`readFilters`, cached by their text; each filter gets `source: 'custom' | 'github'`); a bad filter is skipped with `ERROR: Ignoring filter N (name): …` (custom) or `ERROR: Ignoring GitHub filter N (name): …`, once per version of the files. The website refuses to save one, with the same reasons.

**The GitHub filters** (`playlists/filters.json`, "the starting filters" in specs) are: Halloween kid (`halloween`, `halloween-kid`; Oct, 05:00–07:00 and 17:00–19:30), Halloween grownup (`halloween`, `halloween-grownup`; Oct, 19:30–23:00), Thanksgiving (`thanksgiving`; Fri/Sat Nov 1 to `11-4thu`, plus `11-4thu-1` and `11-4thu`; 17:00–23:00); `favorites` and `upload` are tags played from Play, not filters. No Christmas filter yet, as there are no Christmas videos.

`scheduler/config.js` has only the box settings now (`videoExtensions`, photo settings, `uploads`, `box`: video folder, `rotate`, `landscapeRotate`, `tiltSwitch`, `webPort`, `clockFile`, `mpvSocket`).

## Making a change

Changes to how the display behaves (tags, filters and their schedules, the GitHub filters, overrides, the website, sync, setup, what the status and the log report) go through OpenSpec with this repo's `window-display` schema (`openspec/schemas/window-display/`, CLI 1.14.1: `npm install -g @fission-ai/openspec@1.14.1`). Start with the agentic-coding plugin's `openspec-propose` or `openspec-new-change` skill. Every scenario in a spec is enforced by a test with exactly its name in `scheduler/tests/*.test.js`: `node openspec/check-scenarios.js` lists any scenario without one, and `scheduler/tests/specs.test.js` runs that check over `openspec/specs/` with the other tests. Two reviews are part of every change with a design.md: the agentic-coding plugin's `review-opsx-design`, as a read-only subagent once design.md is written, with every BLOCKING finding settled with the person before tasks; and `review-orchestrator` on the whole change as the last verification task, repeated until no BLOCKING findings remain. Both are told the project is Node, bash, mpv and systemd, not Dart or Python (the schema has the wording). A change to `playlists/filters.json` the person has asked for can skip OpenSpec, but it still needs a pinned test (step 4). A change to one box's own filters isn't a code change at all: the person does it on that box's website. The steps below apply either way.

1. **Pin down the intent in dates.** Turn the request into the exact days and times it should produce, and state them back. Example: "Thanksgiving: Fri/Sat until Thanksgiving, then the day before and the day" means Nov 6, 7, 13, 14, 20, 21, 25 and 26 in 2026, and other November days are black. Check what nearby filters do on the edge days and which is higher in the list, and whether a box's custom filters (which win) would hide the change.
2. **Branch from `origin/main`** and edit `playlists/filters.json` for a shared schedule change; every box picks it up with its next sync.
3. **Videos:** a new season needs `playlists/<name>/` (tag `<name>`), plus subfolders if wanted (`<name>-kid`, …), and a filter that names those tags. A filter whose tags have no videos yet is fine (black, logged once, not an error). Update `playlists/README.md` if the folder rules change.
4. **Test:** `for f in scheduler/tests/*.test.js; do node "$f" || exit 1; done` (Node; mpv, the clock and files are faked). Add a test that pins the exact days or times from step 1, in the style of the Thanksgiving test (a list of covered days for two or three years, through `scheduledFilter`). If you change the filter or schedule logic itself, also test bad entries being skipped and logged. Run `node --check` on each changed `.js` file. The box runs the Node from Raspberry Pi OS's apt (18 or later) with no npm packages, so use only built-in modules. If the change touches `setup.sh`, sync, the systemd units, `player.js`, `mpv.js` or `website.js`, also run the rehearsal on the box's OS (see "Rehearsing on the box's OS" below).
5. **README:** it is a plain, non-technical guide for the person, so no config syntax, rules or anything else from this skill goes in it. Update only the "What's playing" table (each GitHub filter's When in plain words, e.g. "Fridays and Saturdays in November until Thanksgiving, then the day before and Thanksgiving Day itself, 5–11 pm"), and "Using it" / "If something's wrong" if something the person does changes. Details belong in this skill.
6. **Ship:** commit, push, and open a PR with `gh api repos/ndipatri/HalloweenWindowDisplay/pulls -f title=… -f head=<branch> -f base=main -F body=@file` (GraphQL is blocked in cloud sessions, so no `gh pr create`). Merge only when asked: `gh api -X PUT repos/ndipatri/HalloweenWindowDisplay/pulls/<n>/merge -f merge_method=merge`. A cloud session can't push tags or create releases; from the shell on the person's Mac, run git and gh through `.git/tools/gh-run git …` / `.git/tools/gh-run gh …`, which signs in with the repo-only token in `.git/credentials` and waits out that shell's flaky DNS.

## Getting it onto the box (the step that gets missed)

A change under `scheduler/` does nothing until setup is rerun on the box, because setup copies the code to `/opt/tvbox` (so the hourly `git pull` can't change running code). Always end by telling the person to run, after merging:

```sh
ssh tvbox.local
cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh
```

Then check it took:
- The website (http://tvbox.local/) shows what's on screen and why, e.g. `Thanksgiving (scheduled until 11:00 PM)` or `black (nothing scheduled until 5:00 PM)`.
- `tail ~/video-scheduler/scheduler.log` shows `Started.` and a `Filters:` line listing the box's filters.

Video-only changes (adding or removing files in `playlists/`) need nothing: the box syncs a minute after boot and then hourly. To sync now: **Check for new videos now** on the website (or `sudo systemctl start tvbox-sync.service`).

If the box shows the wrong thing, check its filters (their days, times and order) on its website first, then whether setup was rerun after a code change.

## How the box works

- `sudo bash scheduler/setup.sh` (run from the person's user, so `SUDO_USER` is them; safe to rerun):
  - installs `mpv`, `nodejs`, `git`, `logrotate` and `gpiod` with apt;
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
  - starts mpv (`--vo=gpu --gpu-context=drm`, straight to the TV, black when idle, `--video-rotate` from config; `--hwdec=drm --hwdec-codecs=hevc`, so HEVC decodes in hardware and every other codec in software without probing; photos for `photoSeconds` each with `--image-display-duration`, `--keepaspect=yes --panscan=1 --background=color --background-color=#000000`; `keepPlaying` queues every item with its own panscan: `loadfile <path> append-play -1 panscan=1.0` for a photo the screen's measured shape (fills the screen, edges cropped), `panscan=0` for other photos and every video (whole, on black). The global is 1 because mpv puts it back for a moment between items, redrawing the picture still on screen; with it equal to the filling photos' value, one filling photo to the next doesn't flicker. Every item's shape comes from `media_size.js` (`readMediaSize`: a JPEG's or PNG's size from its headers, swapped for EXIF orientations 5–8; an MP4/MOV's from the first video `tkhd` with a size, found by walking the top-level boxes to `moov` wherever it is, swapped when the matrix is a quarter turn, i.e. a = d = 0), measured once per path and file size (`logic.shapeOf`: portrait, landscape, square, or null). **Only items the TV's shape play:** `playlistItems` keeps the items whose shape is the TV's (`readScreen`) or square, the shape being `logic.itemShape`: the tag `portrait` or `landscape` when an item has exactly one (a box tag, so uploads only; it doesn't change the fit, which still uses the measured shape), otherwise `shapeOf`; ones that can't be measured are left out, logged once (`WARNING: Leaving out X in Y: it can't be measured, …`); if nothing is left, it keeps them all and logs once `Nothing in Y is landscape, so it all plays, shown whole.` Turning the TV runs `refilter`, so an item on screen that no longer fits gives way at once. Square photos, and mismatched ones played in that fallback, are shown whole. A lone photo is queued once with `image-display-duration=inf` and held until something else is to play. **Turning the TV:** `screen.json` (`{orientation: 'portrait'|'landscape'}`, portrait when missing) is read every tick; on a change the player sets mpv's `video-rotate` to `rotate` or `landscapeRotate`, sets `panscan` for the item on screen, re-queues the rest (`refilter`) and logs `Screen: landscape (the picture turned 0 degrees).`) **Tilt switch:** with `config.box.tiltSwitch` set (`{ gpio: 17, closed: 'portrait' }`; `null` as shipped, because an unwired pin reads open), each tick first reads the pin with `tilt.js` (`gpioget --bias=pull-up --numeric GPIO17`: 0 closed, 1 open; anything else or a failure rejects, logged once as `WARNING: Couldn't read the tilt switch on GPIO17: …`). A reading held for 2 s that differs from the last one acted on writes `screen.json` (`closed` → that way, open → the other) and logs `Screen: landscape (from the tilt switch).`; the turn then happens in the same tick. A way tapped on the website stays until the switch moves. Setup installs `gpiod`, adds the user to `gpio`, and `tvbox.service` has `SupplementaryGroups=video render gpio`. The rehearsal has no GPIO, so only `tilt.test.js`/`player.test.js` exercise the reading; check a new wiring on the box with `gpioget --bias=pull-up --numeric GPIO17` (0 closed, 1 open)., talks to it over `/run/tvbox/mpv.sock`, and serves the website on port 80 (`CAP_NET_BIND_SERVICE`);
  - every second works out what to show (`whatToShow(readFilters(), …)`: an override, else the highest scheduled filter, else black), writes the status file, and keeps mpv's queue three items ahead (`keepPlaying`);
  - logs `Filters: …` at start;
  - if mpv exits, exits with code 1, and systemd (`Restart=always`) starts both again.

  Both services append to `~/video-scheduler/scheduler.log`.
- **Black until the clock is set:** until `/run/systemd/timesync/synchronized` exists (systemd-timesyncd creates it once the time comes from the network), the status is `black (waiting for the clock to be set)`.
- **Sync** is `scheduler/sync_videos.sh`: `git pull` under `timeout` (60 s; on failure it uses the repo as it is, and it leaves nothing running), then mirrors each folder under `playlists/`. It copies new or changed videos in under a hidden name and renames them into place, and moves videos (or whole subfolders) no longer in the repo to `~/video-scheduler/.removed/`. It never deletes. Top-level folders not in the repo are left alone. `photos` is skipped in both of its loops, even if the repo has `playlists/photos` (then it logs `Skipping playlists/photos: that name is kept for uploads from the website.` once per sync). Once a season folder exists in the repo, it is the master copy for that season. One sync runs at a time: it holds `flock` on `~/video-scheduler/.sync.lock`, and a sync that starts meanwhile (the timer and the website's Check for new videos now overlapping) logs `Skipped: another sync is already running.` and exits 0.
- **Playback:**
  - videos `.mp4`, `.m4v`, `.mov`; photos (`.jpg`, `.jpeg`, `.png`, `config.photoExtensions`) only as uploads;
  - a filter's items in name order with numbers sorted as numbers (a `1-`, `2-` prefix sets the order), round and round; uploads are named in upload order;
  - items are re-read as the queue moves on, so no restart is needed for new videos, uploads or tags;
  - a filter that comes back starts again at the item it was on;
  - a single item loops;
  - a file mpv can't play is skipped and logged once (`ERROR: Skipping x in <filter>`).

  GitHub refuses files over 100 MB. The Pi 5 decodes H.264 in software (fine at 1080p 24 fps) and HEVC in hardware (`--hwdec=drm`); if a repo video stutters, re-encode it to HEVC.
- **Changes while a filter plays:** after a tag or filter save, or an upload removal, the website calls `filtersChanged` (the player's `refilter`, serialised with the tick). It clears mpv's queue behind the item on screen and refills it from the filter's items as they are now; if the item on screen no longer belongs, the next item after it is queued first and then the item removed, so mpv moves straight on without going black. If the playing filter itself is gone, the next tick sorts it out.
- **Uploads:** uploads are named `NNNNN-<cleaned name>` (one above the highest number ever given, kept in the hidden `photos/.last-number`), so name order is upload order and numbers are never reused, even after the newest is removed. Leftover `.upload-*` part files from a restart mid-upload are removed when the website starts. Removing an upload on the website first takes it out of mpv's playlist (`player.dropFile`), then deletes it and its box tags. Sync skips a repo `playlists/photos` (`Skipping playlists/photos: that name is kept for uploads from the website.`).
- **Moving over from My picks:** when the website starts and finds the old `picks.json`, it tags each upload among the picks still on the box `favorites` (GitHub videos among them are left out), removes `picks.json`, and logs `My picks are now tagged favorites (N).`. An `override.json` from before tags could be played (a `filter` or `playlist` key and no `tags`) is removed with `Ending an override from before tags could be played (…).`.
- **Files in `~/video-scheduler/`:** `scheduler.log` (what's showing and why on every change, each video as it starts, overrides, sync, uploads and removals, problems), `status` (one line, what the website shows), `override.json` (only while an override is on), `.removed/`, `photos/` (the uploads; `.upload-*` while one arrives), `upload-pin` (mode 600), `filters.json` (the box's custom filters), `github-filters.json` (the GitHub filters, copied by sync), `tags.json` (the box's own tags), `screen.json` (which way the TV faces, from the website).
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

`bash scheduler/tests/e2e/emulate.sh` runs a box on the Mac, in the rehearsal's Docker image, until Ctrl-C. Use it when the person is away from the real box, or to try a website or player change by hand before shipping. **For starting, restarting and testing with it, use the window-display-emulator skill.**
- **What runs:** a copy of this folder as it is (uncommitted changes included), the real `setup.sh` (upload PIN `1234`, or `TVBOX_EMULATOR_PIN`), sync of the real videos from `playlists/`, the player and mpv. Sync pulls from this folder's current branch (`origin` points at `/src`), never from GitHub.
- **Where:**
  - the website: http://localhost:8080/ (from a phone on the same Wi‑Fi: the Mac's name, port 8080);
  - the "TV": http://localhost:8081/ (`emulator/tv.js`), showing the newest frame and the status line.
- **How the TV works:** `emulator/mpv` wraps mpv with `--vo=null` and saves a JPEG of the picture twice a second to `/tmp/tv`, keeping only the newest few. The page shapes the TV portrait or landscape from `screen.json` and turns the frame back by `rotate` (or `landscapeRotate`), as the turned TV does, and shows black when no frame is from the last two seconds.
- **The clock** is the Mac's, in `TVBOX_TIMEZONE` (default America/New_York). So the filters' schedules follow today's date, and the Play buttons are the way to see other filters.
- **Building:** if the image can't be rebuilt (Docker Desktop offline from Docker Hub), it uses the one built before.
- **Nothing is kept:** uploads, tags, filter changes and the log go when it stops.
- **What it can't show:** smooth motion, sound, and the real TV's colours.

## The website

The player serves it at http://tvbox.local/ (`scheduler/website.js`). It writes `~/video-scheduler/override.json` (`{ tags: [tag…] | null, filters: [name…], setAt, expires, untilCleared }`; `tags: null` is black). What plays is the key `pickName(tags, filters)`, like `#favorites + Halloween kid`: tags marked `#`, filters by name, joined with ` + ` (`playlistItems` parses it back into everything with any of those tags, or in any of those filters, minus each filter's except tags, once each):

- **Play:** "Now: <status>", a button per tag in use that no GitHub filter names in its any of or except (`choices()`; the GitHub videos play through their filters; `tagLabel`: `upload` → Uploads, `halloween-grownup` → Halloween grownup) and per filter in the box's order (`GET /api/choices` → `{ tags, filters }`). Tapping one picks or unpicks it (`picked` class, `aria-pressed`); **Play** (off until something is picked) sends them all, then the picks clear. Then Black, and Back to schedule. The buttons for what is on screen are outlined and `aria-current` (`playingChoices(status, filters)`: the text before ` (`, split on ` + `, keeping `#tag`s and filter names; `['black']` for black).
- **Durations:** until the schedule changes, 15, 30 or 60 minutes, or until switched back (`untilCleared`). The page starts on until switched back (the person's choice); `POST /api/show` without `until` still lasts until the schedule changes. An override naming a filter that's gone is ended (`Ending the override: there is no filter called X any more.`); one whose tags have nothing in them shows black and says so once (`Nothing tagged x yet. Showing black until something is.`).
- **Tags:** the uploads from `GET /api/items` (`{ items: [{ path, group, folderTags, boxTags, kind }], tags }`: uploads only; `tags` is every tag in use, folder tags included, for the filter editor), with box tags as chips with ×, a ☆/★ for `favorites`, and an add-a-tag field with a `<datalist>` of the tags in use. Each change is `POST /api/tags { path, add | remove }` (no PIN): `Tagged x favorites.` / `Took favorites off x.`; refusals `<path> comes from GitHub: its tag comes from its folder there.`, `Not a tag name: … Use lowercase letters, digits and dashes.`, `upload is given to every upload by the box.`, 404 `No item <path> on the box.`; logged `Tags: <path> + <tag> (from the website).`.
- **Filters:** `GET /api/filters` (`{ custom, github }` as saved). The page shows the GitHub filters read-only ("From GitHub") and edits a copy of the custom ones (↑/↓ via `moveFilter`, Edit, Delete, New filter; the editor has name, any of/except ticks of the tags in use plus typed tags, and entries with from/to, weekday ticks, extra days and times like `17:00-23:00`) and sends the whole custom list with **Save filters**: `POST /api/filters { filters }` (custom only; a GitHub name is refused: `<name>: GitHub has a filter called …; pick another name.`) with header `X-Upload-Pin` (the upload PIN and its lock). Answers `Saved N filters.`, logs `Filters changed (from the website): …`; refuses 403 `Wrong PIN.` / `Editing filters is off until a PIN is set on the box.`, 400 `<filter>: <what's wrong>.` (nothing saved), 413 `That list of filters is too long.` (over 200 000 bytes).
- **API (the rest):** `GET /api/status` (`{status}`), `POST /api/show {tags: [tag…], filters: [name…], until: 'schedule'|'cleared'|minutes}` or `{target: 'black', until}` (refuses `Pick one or more tags or filters to play.`, `No tag called X on the box.` and `No filter called X on the box.`), `POST /api/schedule`, `POST /api/sync` (runs `~/video-scheduler/sync` with output appended to the log; answers at once with `Checking GitHub for new videos. …`, or `Already checking for new videos.`), `GET /api/log` (`{lines}`: the last 20 non-empty lines, read from the last 16 KB), `GET /api/screen` (`{orientation}`) and `POST /api/screen {orientation: 'portrait'|'landscape'}` (no PIN; saves `screen.json`, logs `Screen: landscape (from the website).`, answers `The picture is turned for a landscape TV.`; anything else is 400 `The TV is portrait or landscape.`).
- **New videos from GitHub** (a line saying what the sync does and doesn't do, and a **Check for new videos now** button) and **Recent activity** are on the page. The activity list refreshes with the status every few seconds.
- An override with no time lasts until the schedule next changes. Overrides with a time end by themselves; one until switched back (the page's default) stays until Back to schedule, so a forgotten grownup choice plays on into the morning.
- **Uploads** (Add photos or videos): the page checks the whole batch first, then sends each file as one raw POST (`XMLHttpRequest`, for progress), stopping at the first refusal; a wrong PIN or a lock forgets the PIN kept in `localStorage`. The batch flow is `sendBatch` in its own `<script>` block, so the tests run it in `vm`. Each file streams into `photos/.upload-<random>` and is linked to its numbered name only when every byte has arrived; one that stops partway is deleted and logged. Limits come from `config.uploads`: at most 1 GB a file, 2 GB must stay free (`fs.statfsSync`), 5 wrong PINs in a row (uploads, checks and removals together) lock for 5 minutes (in memory; a restart clears it). The server has no overall request timeout (`requestTimeout: 0`) and closes a connection idle for 2 minutes.

  | Route | Request | Success | Refusals |
  |---|---|---|---|
  | `GET /api/uploads` | – | `{ pinSet, uploads: [{ name, kind: 'photo'\|'video', bytes }] }` in play order | – |
  | `POST /api/uploads/check` | header `X-Upload-Pin`; `{ files: [{ name, bytes }] }` | `Ready to add N files.` | 403 `Wrong PIN.` / `Adding photos is off…`; 429 `Too many wrong PINs…`; 400 type; 413 too big; 507 no room |
  | `POST /api/uploads?name=…` | header `X-Upload-Pin`, `Content-Length`; the file as the body | `Added <name>.` | as check; 400 `Bad request.` |
  | `POST /api/uploads/remove` | header `X-Upload-Pin`; `{ name }` | `Removed <name>.` | 403, 429; 404 `No upload named <name>.` |
  | `GET /photos/<name>` | optional `Range` | 200 or 206, cacheable for a year | 404 `Not found.`; 416 |
- Only adding and removing photos and saving filters need a PIN; choosing and tagging have no password, as the website is only reachable on the home network.

## Troubleshooting the box

| Symptom | Cause / fix |
|---|---|
| The wrong filter plays | Check the filters' days, times and order on the website; the higher one wins on overlap |
| No `Filters:` line in the log after an update | Setup not rerun: `git pull && sudo bash scheduler/setup.sh` |
| `black (waiting for the clock to be set)` | No network time yet: Wi‑Fi down, or timesyncd off (`timedatectl`) |
| `black (nothing scheduled …)` | Expected outside every filter's entries; otherwise check the entries' days and times |
| `Nothing in X yet (any of …)` | No item has those tags: the folder isn't on the box (not in the repo, a name mismatch giving another tag, or not synced: `sudo systemctl start tvbox-sync.service`), or nothing is tagged yet |
| `ERROR: Ignoring filter N` | A hand-edited `filters.json` entry is bad; the log says what. Fix it on the website |
| `No filters on this box yet` | No `github-filters.json` (not synced yet: Check for new videos now) and no custom filters |
| `ERROR: Ignoring filter N (x): GitHub has a filter called …` | A custom filter has a GitHub filter's name: rename it under Filters (saving is refused until then) |
| `ERROR: Ignoring GitHub filter N` | A mistake in `playlists/filters.json` in the repo; the log says what. Fix it there |
| `Leaving out <folder>: its name doesn't make a tag` | Rename the folder in `playlists/` to letters, digits and dashes, 30 at most |
| Screen not following the schedule | An override is in force: the website's Back to schedule |
| `Couldn't pull from GitHub` | Box offline; it plays what it has. Syncs again within the hour |
| Website: `The box has not started yet` | No status file: the player isn't running (`systemctl status tvbox`, then the log) |
| `ERROR: mpv stopped` repeating | mpv can't open the screen: TV not connected at boot, or the user not in `video`/`render` (rerun setup, then reboot) |
| `Website on port 80: … EADDRINUSE` | Something else has port 80: change `webPort` in config.js |
| `ERROR: Skipping …` | Damaged or unplayable file; re-export as H.264 MP4. For an uploaded photo, it may be too large for the GPU (48 MP and up): shrink it and add it again |
| `Cannot load libcuda.so.1` / `Failed setup for format vulkan` on every video | mpv probing hardware decoders the Pi 5 doesn't have for H.264: the box runs code from before `--hwdec-codecs=hevc`; rerun setup. Harmless, as playback falls back to software |
| An uploaded HEVC video stutters, or its colours look washed out | iPhone 4K HDR (10-bit) video. Try `--hwdec=drm-copy` in `mpv.js`; or on the phone turn off HDR video, or share at 1080p |
| Website: `Adding photos is off: no upload PIN is set on the box.` | No valid `~/video-scheduler/upload-pin` (a card's unattended first boot sets none): `sudo TVBOX_UPLOAD_PIN=1234 bash scheduler/setup.sh` |
| `Five wrong upload PINs in a row: uploads locked until …` | Someone typed the PIN wrong five times; it unlocks by itself after five minutes (or on a restart) |
| A video vanished from the box | Not in the repo, so sync moved it to `.removed/`; add it to the repo |
| `Ignoring …/override.json` | Malformed override; Back to schedule deletes it |
| Picture upside down or sideways | `rotate` in config.js (90 ↔ 270), then rerun setup |
| Black but log says `playing …` | TV input/brightness, or the curtain is too thick |

Add new failures to this table. Only add a row to the README's "If something's wrong" if the person can fix it with a plain step.
