## Context

See proposal.md - Why. The website runs inside the player's process as the person's user (`tvbox.service`). Sync is `~/video-scheduler/sync`, run hourly by `tvbox-sync.timer`, with output appended to `~/video-scheduler/scheduler.log`. The log is kept under about 5 MB by logrotate (cap-the-log).

## Goals / Non-Goals

**Goals:**
- Sync now from the page, safe to press at any time.
- The log's last lines on the page, cheap to serve every few seconds.

**Non-Goals:**
- A log viewer or search.
- Reporting when a sync finishes as its own message: the activity list shows its `Done:` line.

## Decisions

- **The website runs `~/video-scheduler/sync` itself,** as a child process with its output appended to the log, as systemd does for the timer. Rejected: `systemctl start tvbox-sync.service`, which the person's user isn't allowed to do without sudo or a polkit rule.
- **`createWebsite` gets `startSync()`,** which returns `false` when a sync it started is still running. The tests pass a fake. `startWebsite` passes the real one: it spawns the sync with stdout and stderr appended to the log, and clears its "running" mark when the sync exits, or fails to start, which is logged as `ERROR: Couldn't start sync: …`.
- **Sync takes a lock:** `flock -n` on `~/video-scheduler/.sync.lock`, held on file descriptor 9 for the whole run. A second sync logs `Skipped: another sync is already running.` and exits 0. This covers the website and the timer overlapping, which the website's own mark can't see. `flock` comes with util-linux on Raspberry Pi OS. The lock file is hidden, so the website doesn't offer it as a season, and the player ignores it. Rejected: a PID file, which goes stale after a crash, whereas an flock is released by the OS when the process ends.
- **`GET /api/log` returns `{ lines }`:** the last 20 non-empty lines, oldest first. `createWebsite` gets `readTail(path, bytes)`: the real one reads only the last 16 KB, so the cost stays the same however big the log gets. The tests' fake slices the whole text.
- **The page** gets a Sync now button under Schedule and a Recent activity list at the bottom, refreshed every 5 seconds with the status. The list uses a small monospace font and wraps long lines.

Each scenario's test reaches the behaviour like this:
- **website:** `createWebsite(...).handle(...)` with a fake `startSync` and `readTail`;
- **the lock:** the real `sync_videos.sh`, with a test process holding `.sync.lock` through `flock`.

## Risks / Trade-offs

- [A sync started by the website outlives a player restart] → The lock keeps the next sync from overlapping it, and it finishes by itself.
- [`flock` missing] → It's part of util-linux, which every Debian has. The rehearsal checks the lock on the box's OS.

## Getting it onto the box

Rerun setup after merging (`player.js`, `website.js` and the sync script change). Then check the page has Sync now and Recent activity, and that pressing Sync now adds `sync:` lines within a minute.

Rehearsal coverage: this change touches `website.js`, `player.js` and `sync_videos.sh`, all of which the rehearsal runs. New checks in `inside.sh`:
- "Sync now starts a sync that finishes in the log";
- "the website shows the log's last lines";
- "a second sync while one runs is skipped".
