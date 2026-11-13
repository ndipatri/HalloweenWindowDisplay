## Context

`sync_videos.sh` pulls (`pull` logs `ERROR: <repo> isn't a git checkout, so can't pull. Using the videos as they are.` when `git -C "$repo" rev-parse --git-dir` fails), then `copy_videos`, which, with no `$repo/playlists`, logs `No playlists/ folder in <repo> yet; nothing to copy.` and calls `github_filters`; that removes `github-filters.json` whenever the repo has no `playlists/filters.json`, including when the repo isn't there at all.

## Decisions

**Decide by "is it a git checkout".** The same test `pull` uses. In `github_filters`, before removing the box's copy, check `git -C "$repo" rev-parse --git-dir`; if it fails, keep the copy and log `Keeping the GitHub filters: <repo> isn't a git checkout.` A checkout with no `playlists/filters.json` (or no `playlists/`) still removes it, as the GitHub filters were deliberately taken out.

**Nothing else changes.** Videos are never set aside without a `playlists/` folder (unchanged), so a missing repo already leaves the videos alone.

## Testability

`sync.test.js` runs the real script with `VIDEO_SCHEDULER_REPO` pointed at a folder that doesn't exist, and at a plain folder that isn't a checkout.

## Rehearsal

The change touches `sync_videos.sh`, which the rehearsal runs; its existing sync checks cover the normal path. No new rehearsal check: the missing-repo case is covered by the Node test.

## Box-only

None.
