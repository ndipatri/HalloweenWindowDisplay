## Why

A new video reaches the box within the hour, but there's no way to make it come now without `ssh`. And to see what the box has been doing, you have to `ssh` in and read the log. Both are things the person wants from their phone, on the page they already use.

## What Changes

- **Sync now** on the website: it starts the same sync the hourly timer runs, with its output going to the same log. It says so when a sync is already running.
- **Recent activity** on the website: the last 20 lines of the log, refreshed every few seconds.
- **One sync at a time:** sync takes a lock, and a sync that starts while another is running logs that it skipped and stops. Without this, Sync now pressed during the hourly sync could have two copies writing the same video at once.
- The README's Using it and Everyday tasks mention the button and the activity list. The schedule skill gets the API and the lock.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `override-website`: adds Sync now and Recent activity. The capability is created by replace-mac-with-pi-box, which isn't archived yet, so these are ADDED requirements, and this change must be archived after it.
- `video-sync`: adds "One sync at a time". It's created by add-sync-specs, also not archived yet, so the same rule applies.

## Impact

- `scheduler/website.js`: `POST /api/sync`, `GET /api/log`, and the page. `startWebsite` gets the real sync starter and log reader.
- `scheduler/player.js`: `realIo` gains `readTail` (the end of a file, without reading all of it).
- `scheduler/sync_videos.sh`: the lock (`flock` on `~/video-scheduler/.sync.lock`).
- Tests: `website.test.js`, `sync.test.js`, and new rehearsal checks.
- `README.md`, `.claude/skills/window-display-schedule/SKILL.md`.

## Assumed product decisions

- **20 lines, oldest first, refreshed every 5 seconds,** shown as they are in the log. Rejected: a whole log viewer.
- **Sync now answers at once** ("Syncing now…") rather than waiting for the sync to finish. The activity list shows it finishing.
- **No password,** as for the rest of the website: syncing early is harmless.
