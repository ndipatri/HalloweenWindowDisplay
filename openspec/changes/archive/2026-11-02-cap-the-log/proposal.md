## Why

On the box, `~/video-scheduler/scheduler.log` lives on the SD card. The player adds a line for every video and every change on screen, and sync adds lines every hour, all season long, with nothing ever removing them. On the Mac that was harmless. On an SD card it slowly eats space and wears the card.

## What Changes

- `scheduler/logrotate/tvbox`, a logrotate rule for the log:
  - weekly, or sooner once it passes 5 MB;
  - four old logs kept, the newest plain (`scheduler.log.1`) and the rest compressed;
  - `copytruncate`, because the player and sync keep the log open.
- `setup.sh` installs `logrotate` (Raspberry Pi OS normally has it, and runs it daily) and the rule, as `/etc/logrotate.d/tvbox`.
- The rehearsal checks the rule on the box's OS while the player runs.
- The README tells the person where last week's log is. The schedule skill explains the rotation.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- None. What the display shows and logs doesn't change, only how long old log lines are kept. This is box-only behaviour (logrotate and the OS's daily timer), so this change sets `skip_specs: true`, and the rehearsal covers it.

## Impact

- New `scheduler/logrotate/tvbox`; `scheduler/setup.sh`; `scheduler/tests/e2e/Dockerfile` and `inside.sh`; `README.md`; `.claude/skills/window-display-schedule/SKILL.md`.
- On the box: `/etc/logrotate.d/tvbox`, after setup is rerun.

## Assumed product decisions

- **About a month of logs** (weekly × 4), and no more than about 5 MB per log before rotating. Rejected: keeping everything, which is what fills the card.
