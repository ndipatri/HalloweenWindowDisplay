## Context

See proposal.md - Why. Today `scheduler/video_scheduler.js` mixes two things: the season, schedule, override and playlist logic (plain JavaScript, covered by 26 tests through a loader that fakes the Mac), and the macOS parts (AVQueuePlayer, the portrait window, launchd). The box needs the first and replaces the second.

## Goals / Non-Goals

**Goals:**
- The logic runs unchanged on the box, and the existing 26 tests keep their names and what they check.
- The box plays on its own after `setup.sh`: at boot, after a crash, and with no network.
- Every new behaviour is a scenario with a test, with mpv, the clock and the file system faked.

**Non-Goals:**
- Keeping the Mac working from `main` (the `mac-legacy` tag does that).
- A read-only system, HDMI‑CEC, or the website triggering a sync (see proposal.md - Assumed product decisions).

## Decisions

**Modules, all CommonJS with no npm packages, in `scheduler/`:**

| File | Job |
|---|---|
| `config.js` | `CONFIG`: seasons, schedule, video extensions, and the box settings (video folder, rotation, website port, clock file). The one file to edit for seasons and times. |
| `logic.js` | `createScheduler(io)`: the logic moved from the JXA script, including override reading and the playlist queue. `io` supplies `readText`, `writeText`, `removeFile`, `listFolder` and `log`, so tests pass fakes. |
| `mpv.js` | Starts mpv and talks to it over its JSON IPC socket: `command(...)`, `getProperty(name)`, and the events it sends. |
| `player.js` | `createPlayer(...)` with a `tick()` run every second: the clock check, `whatToShow`, status and log, and the mpv queue. `main()` wires up the real file system, mpv and the website. |
| `website.js` | `createWebsite(...)` with `handle(request)` returning `{ status, type, body }`, plus the page. `main()` serves it with `http`. |
| `setup.sh`, `systemd/*` | One-time setup on the Pi, and the service and timer units. |

- **The logic moves as it is.** Each function keeps its name and body, wrapped in a factory over `io` in place of the JXA globals. Rejected: rewriting it for mpv, which would change what the 26 tests prove.
- **The playlist queue keeps the same shape over mpv.** `keepPlaying(playlist, mpv)` keeps three videos queued, in name order and round and round. It removes the videos already played from mpv's playlist, logs each one as it starts, and skips a failed one (mpv's `end-file` event with an error). Switching playlists stops mpv and queues the new playlist. A playlist that comes back starts again at the video it was on, the closest mpv gets to the Mac pausing one queue per playlist. Rejected: one mpv per playlist, which would mean several processes holding the screen.
- **The scheduler tests keep their names.** Their loader requires `logic.js` with fake `io`, and the six playback tests drive a fake mpv instead of a fake AVQueuePlayer, checking the same order, folders and log lines.
- **mpv settings:** `--idle --force-window` (black when nothing plays), `--fullscreen`, `--vo=gpu --gpu-context=drm` (straight to the TV, no desktop), `--video-rotate=<config>`, `--no-audio`, `--hwdec=auto-safe`, `--prefetch-playlist` (the next video is ready), `--no-osc --osd-level=0`, `--no-input-default-bindings --input-terminal=no` (no keyboard control: the socket is the only way in), `--cursor-autohide=always`, `--msg-level=all=warn` (only warnings and errors in the log), and `--input-ipc-server=/run/tvbox/mpv.sock` (`mpvSocket` in `config.js`; systemd's `RuntimeDirectory=tvbox` creates `/run/tvbox` for the player's user). The Pi 5 decodes H.264 in software, which is fine for one 1080p 24 fps video at a time.
- **The clock check** is whether `/run/systemd/timesync/synchronized` exists. systemd-timesyncd creates it once the time is set from the network. It's a file, so tests fake it. Rejected: a fixed wait after boot, which says nothing about whether the time is right.
- **If mpv exits,** the player logs it and exits with code 1. systemd (`Restart=always`) starts the player again with a fresh mpv. Rejected: restarting mpv inside the player, which duplicates what systemd already does.
- **An error inside one tick** (an mpv command refused, say) is logged as `ERROR: …` and the player carries on with the next tick a second later. Rejected: exiting on any error, which would turn a passing hiccup into a restart and a black screen.
- **The website runs in the player's process** on port 80 (`AmbientCapabilities=CAP_NET_BIND_SERVICE`, so it doesn't need root). It writes `override.json` in the format `show` wrote, so `parseOverride` and the overrides spec apply unchanged. Its replies use `show`'s wording, changed only where `show` named a command. If the website can't start (port 80 taken, say), that is logged as `ERROR: Website on port …` and the videos keep playing: the TV matters more than the page. Once listening, it logs `Website: http://<hostname>.local/`.
- **The log** stays `~/video-scheduler/scheduler.log`: systemd appends the player's and the sync's output to it. The status file stays `~/video-scheduler/status`.
- **Sync** is `sync_videos.sh`, unchanged, installed as `~/video-scheduler/sync` and run by `tvbox-sync.timer` 1 minute after boot and then hourly.
- **Setup copies the code** into `/opt/tvbox`, so a `git pull` by sync can't change running code. Rejected: `~/video-scheduler/app/`, because every folder in the video folder is offered on the website as a season to preview. Setup does:
  - installs the apt packages (`mpv`, `nodejs`, `git`);
  - adds the user to the `video` and `render` groups;
  - sets the time zone (`TVBOX_TIMEZONE`, default America/New_York) and turns on network time;
  - copies `config.js`, `logic.js`, `mpv.js`, `player.js` and `website.js` to `/opt/tvbox`;
  - writes `~/video-scheduler/sync` from `sync_videos.sh` with the repo's path filled in;
  - writes the three units from `scheduler/systemd/` and enables them;
  - runs one sync, so the videos are there before the first play;
  - starts the hourly timer and restarts the player.

  It checks Node is 18 or later, and refuses to run without `sudo` or as root directly (the box must run as the person's user).

  It's safe to rerun.

Each scenario's test reaches the behaviour like this:
- **box-player:** `createPlayer` with a fake mpv (an in-memory playlist that records commands and can play the next video, fail a file or exit), a fake clock file and fake folders, ticked at chosen moments.
- **override-website:** `createWebsite(...).handle(...)` with fake files and a fixed `now`.
- **The mpv exit scenario:** `watchMpv` on a fake child process.

## Risks / Trade-offs

- [Software H.264 decoding on the Pi 5 drops frames] → Check on the box (follow-up). If it does, sync can re-encode to HEVC, which the Pi 5 decodes in hardware.
- [mpv's DRM output fails with the TV, or the rotation is wrong] → Check on the box. `rotate` is one setting in `config.js`.
- [Port 80 is taken] → `webPort` in `config.js`.
- [An SD card corrupts when unplugged mid-write] → Most writes are small. A read-only system is a later change.
- [The website has no password] → Home network only, and an override always ends by itself unless "until switched back" is chosen.

## Migration Plan

1. Flash Raspberry Pi OS Lite (64-bit) with Raspberry Pi Imager. Set the hostname `tvbox`, Wi‑Fi, a user, and SSH.
2. On the Pi: `git clone https://github.com/ndipatri/HalloweenWindowDisplay.git ~/HalloweenWindowDisplay && cd ~/HalloweenWindowDisplay && sudo bash scheduler/setup.sh`.
3. Open `http://tvbox.local/` and check the status. Plug the Pi into the TV in place of the Mac.
4. Rollback: plug the Mac back in. It still runs its last install, or `git checkout mac-legacy && bash scheduler/install.sh` on it.

## Getting it onto the box

This change is the first setup, so it needs `setup.sh` (Migration Plan step 2). Then check that the website's status line matches the time of day, and that `~/video-scheduler/scheduler.log` starts with `Started.` and the `Seasons:` line. Box-only checks:
- smooth playback;
- the picture turned the right way;
- black at boot until the clock is set;
- playing again after `sudo systemctl kill tvbox` (systemd restarts it);
- after a reboot;
- with Wi‑Fi off.
