## Why

`sync` decides which videos are on the box. It copies new and changed videos from GitHub and sets aside ones that were removed. It's the last important part of the display with no tests, so nothing stops a change to it from, say, deleting videos or playing a half-copied file. Writing its behaviour down as scenarios, each with a test of the same name, puts it under the same guard as the rest.

## What Changes

- A new `video-sync` capability describing what `sync` does.
- One fix the tests found in `scheduler/sync_videos.sh`. Its hand-made pull watchdog (`sleep` then `kill`, written for the Mac, which has no `timeout` command) left its `sleep` running, holding sync's output open for the whole time limit (60 seconds) after sync had finished. The pull now runs under `timeout`, which the box's Linux has. On the box, systemd was already cleaning up the leftover `sleep`, so the window wasn't affected.
- `scheduler/tests/sync.test.js`: one Node test per scenario. Each runs the real `sync_videos.sh` against temporary folders, with a local git repository standing in for GitHub.

## Capabilities

### New Capabilities
- `video-sync`: keeping the box's video folder the same as the repo's `playlists/`: pulling from GitHub, copying new and changed videos, setting removed ones aside (never deleting), and carrying on when GitHub can't be reached.

### Modified Capabilities
- None.

## Impact

- New `scheduler/tests/sync.test.js`. The tests need `bash` and `git`, both already required by the repo.
- `scheduler/sync_videos.sh`: the pull runs under `timeout --kill-after=5` instead of the watchdog. It logs the same lines as before.
- Nothing to install on the box beyond rerunning setup, which copies the new sync.

## Assumed product decisions

- The scenarios describe today's behaviour exactly, including log wording, apart from the watchdog fix, which changes no log line. Rejected: changing anything else while writing it down.
