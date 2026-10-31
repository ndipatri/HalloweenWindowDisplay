#!/bin/bash
# Run by the launch agent at login, after install.sh, and if the scheduler
# ever stops unexpectedly. Updates the videos from the repo, then runs the
# scheduler. Installed as ~/video-scheduler/start.
#
# Updating never stops the display: if GitHub can't be reached (or takes
# more than a minute), the scheduler starts with the videos already here.

dir="${VIDEO_SCHEDULER_ROOT:-$HOME/video-scheduler}"
stamp="$dir/.last-sync"

# Pull at most once every 10 minutes, so a scheduler that keeps crashing
# doesn't keep hitting GitHub. Run ~/video-scheduler/sync to update sooner.
if [ -n "$(find "$stamp" -mmin -10 2>/dev/null)" ]; then
  echo "$(date '+%m/%d/%Y, %-I:%M:%S %p')  sync: Skipped (synced in the last 10 minutes)." >&2
else
  touch "$stamp"
  "$dir/sync" >&2
fi

exec /usr/bin/osascript -l JavaScript "$dir/video_scheduler.js"
