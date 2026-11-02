## Context

See proposal.md - Why. `tvbox.service` and `tvbox-sync.service` send their output to the log with `StandardOutput=append:`, so systemd keeps the file open in append mode while they run. Raspberry Pi OS ships `logrotate` with a daily `logrotate.timer`.

## Goals / Non-Goals

**Goals:**
- The log never grows past about 5 MB plus a few compressed old copies.
- No log line is lost or written into a rotated file, and nothing needs restarting.

**Non-Goals:**
- Changing what is logged.
- The systemd journal: the services don't write to it.

## Decisions

- **logrotate, the OS's own tool,** with a rule in `/etc/logrotate.d/`. Rejected: rotating inside the player, which would be more code, and sync writes to the same file too.
- **`copytruncate`:** the file is copied, then emptied in place. Because systemd opened it in append mode, the services' next lines go to the start of the emptied file. Rejected: renaming plus a restart in `postrotate`, which would black out the screen for a moment every week. Without either, the services would keep writing into `scheduler.log.1`, as the rehearsal showed.
- **`su <user> <user>`:** the log's folder belongs to the person's user. logrotate does the rotation as that user, so the files stay theirs.
- **`weekly` with `maxsize 5M`, `rotate 4`, `compress` and `delaycompress`:** about a month of logs. The last week stays plain text for reading with `less`.
- **Setup installs `logrotate` explicitly,** in case it's missing, and writes the rule with the user and home filled in, mode 644.

## Risks / Trade-offs

- [`copytruncate` can lose lines written in the instant between copy and truncate] → The player writes at most a few lines a minute, so the chance is tiny, and a lost line costs nothing but a log line.
- [logrotate only runs daily] → A runaway log could pass 5 MB by up to a day's lines before rotating. That's fine at this logging rate.

## Getting it onto the box

Rerun setup after merging. Then `logrotate -d /etc/logrotate.d/tvbox` shows the rule with no errors, and after a week `scheduler.log.1` appears.

Rehearsal coverage: this change touches `setup.sh` and adds a file setup installs. New checks in `inside.sh`:
- "setup installs the log rule, and logrotate accepts it";
- "rotating keeps the old log as scheduler.log.1";
- "the new log starts empty";
- "after rotating, the player keeps writing to the log";
- "the rotated log has no gap of empty bytes".

The rotation is forced with `logrotate -f` while the player is running.
