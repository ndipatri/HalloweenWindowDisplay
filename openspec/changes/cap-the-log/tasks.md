# Tasks

## 1. The rule and setup

- [x] 1.1 Add `scheduler/logrotate/tvbox` (weekly, maxsize 5M, rotate 4, compress, delaycompress, missingok, notifempty, copytruncate, su as the user)
- [x] 1.2 Make `setup.sh` install `logrotate` and write the rule to `/etc/logrotate.d/tvbox` with the user and home filled in; verify `bash -n`

## 2. Rehearsal checks

- [x] 2.1 Add `logrotate` to the rehearsal image, and five checks to `inside.sh`:
  - the rule is installed and `logrotate -d` reports no error;
  - a forced rotation while the player runs keeps the old log as `scheduler.log.1`, which still holds the `Seasons:` line;
  - the new log starts empty;
  - the player's next line ("Now showing: black …") lands in the new log;
  - the new log has no run of empty bytes.

## 3. Docs

- [x] 3.1 README: where last week's log is; the schedule skill: setup installs the rule, and how rotation works and why `copytruncate`

## 4. Verification

- [x] 4.1 Run the rehearsal and verify `28 passed, 0 failed` (the 23 earlier checks plus the 5 new ones)
- [x] 4.2 Disable check: remove `copytruncate` from the rule and rerun. Verify the rotation checks fail (`24 passed, 4 failed`: the new log isn't empty, the player's next line goes to the rotated file, and so on), then restore the line.
- [x] 4.3 Rerun the rehearsal on the restored, final files and verify `28 passed, 0 failed`
- [x] 4.4 Run every Node test file and verify they pass (no Node code changed)
- [x] 4.5 Run `openspec validate cap-the-log --strict` and verify it is valid

## Workflow follow-up

- On the box, after merging: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`, then `sudo logrotate -d /etc/logrotate.d/tvbox` shows no errors.
- Archive this change with the others after review.
