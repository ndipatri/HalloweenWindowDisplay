## Why

After the box's code folder was moved (`~/HalloweenWindowDisplay` to `~/tvBox`) and before setup re-pointed sync at it, the hourly sync ran against the missing folder. It logged that it couldn't pull, found no `playlists/` folder, took that to mean "the repo has no filters", and deleted the box's GitHub filters: nothing was scheduled until setup ran again.

## What Changes

- **Sync keeps the GitHub filters when the repo isn't there.** When the repo folder is missing or isn't a git checkout, sync leaves `github-filters.json` as it is, logs `Keeping the GitHub filters: <repo> isn't a git checkout.`, and copies and sets aside nothing (as today).
- Unchanged: a real repo with no `playlists/filters.json`, or no `playlists/` at all, still removes the box's copy.

## Capabilities

### Modified Capabilities

- `video-sync`: "Brings the GitHub filters" keeps the box's copy when the repo isn't a git checkout.

## Impact

- **Code:** `scheduler/sync_videos.sh` (`github_filters`).
- **Tests:** `sync.test.js`; the rehearsal runs sync as before.
