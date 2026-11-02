## Context

See proposal.md - Why. `scheduler/sync_videos.sh` is plain bash. Setup installs it as `~/video-scheduler/sync` with the repo's path filled in, and `tvbox-sync.timer` runs it a minute after boot and then hourly. It has run on the Mac for weeks and, since add-box-rehearsal, on the box's OS. It has no tests.

## Goals / Non-Goals

**Goals:**
- Each behaviour of `sync` is a scenario with a Node test of the same name.
- The tests run the real script, with real git, and fake nothing that can be real.

**Non-Goals:**
- Changing what `sync_videos.sh` does (the watchdog fix below changes how, not what).
- Testing the timer: that is the rehearsal's and the box's job.

## Decisions

- **The tests run the real script with `spawnSync('bash', [script, ...])`.** It works on a throwaway setup:
  - a bare git repository standing in for GitHub;
  - a clone of it standing in for the box's repo;
  - an empty folder standing in for `~/video-scheduler`.

  The script's own settings point it there: `VIDEO_SCHEDULER_REPO`, `VIDEO_SCHEDULER_ROOT` and `VIDEO_SCHEDULER_PULL_TIMEOUT`. Rejected: faking git, which would test the fake rather than the pull.
- **Two scenarios need something to go wrong, so a small fake goes first on `PATH`:**
  - a `git` that waits forever when asked to `pull` (otherwise it runs the real git), for the time limit;
  - a `cp` that writes part of the file and fails, for the failed copy.
- **"Not rewritten" is checked by the file's inode and modified time** before and after.
- **Videos are small text files with video names.** Sync never looks inside them.
- **The tests' pull time limit defaults to 10 seconds,** so a broken time limit fails fast; the scenarios that need another set it.
- **The pull runs under `timeout --kill-after=5 "$pull_timeout"`.** Before, a background `sleep` then `kill` watchdog was used, because the Mac had no `timeout`. Killing the watchdog left its `sleep` running with sync's output open. Exit status 124 (timed out) or 137 (killed) is logged as `no answer within N seconds`, as before. Rejected: keeping the watchdog with its output sent to `/dev/null`, which still leaves a stray process for up to a minute.

Each scenario's test reaches the behaviour like this: the real script, through the paths above, with one of the two fakes for the time-limit and failed-copy scenarios.

## Risks / Trade-offs

- [The tests need `bash` and `git`] → Both are already required by the repo and installed on the box. CI or a laptop without them would fail on the first run, loudly.
- [The time-limit test takes about a second] → It's acceptable, and the limit is set to 1 second for it.

## Getting it onto the box

Rerun setup on the box after merging, so it installs the new `~/video-scheduler/sync`. Then check that the log's next sync line, within the hour, is `Pulled the latest from GitHub (…)`.

Rehearsal coverage: this change touches `sync_videos.sh`, which the rehearsal runs. These checks cover it on the box's OS, with `timeout` from Debian 13's coreutils:
- "setup's first sync copies the videos over";
- "sync logs that GitHub can't be reached and carries on".
