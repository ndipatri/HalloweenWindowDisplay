#!/bin/bash
# Installs (or reinstalls) the video scheduler for the current user.
# Run from Terminal, without sudo:   bash scheduler/install.sh
set -euo pipefail

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this without sudo." >&2
  exit 1
fi

here="$(cd "$(dirname "$0")" && pwd)"
dest="$HOME/video-scheduler"
label="com.user.videoscheduler"
plist="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"
service="$domain/$label"

is_loaded() { launchctl print "$service" >/dev/null 2>&1; }

# bootout has no "wait" option: it returns while launchd is still removing
# the job, and a bootstrap in that window fails with
# "Bootstrap failed: 5: Input/output error". So wait for the job to be gone.
wait_until_unloaded() {
  local tries=0
  while is_loaded; do
    tries=$((tries + 1))
    if [ "$tries" -gt 100 ]; then # 10 seconds
      echo "The old scheduler is still loaded after 10 seconds." >&2
      echo "Log out and back in (it starts by itself at login), or check:" >&2
      echo "  launchctl print $service" >&2
      exit 1
    fi
    sleep 0.1
  done
}

new_plist="$(mktemp)"
trap 'rm -f "$new_plist"' EXIT
sed "s#__HOME__#$HOME#g" "$here/$label.plist" > "$new_plist"
plutil -lint "$new_plist" >/dev/null

mkdir -p "$dest/kid" "$dest/grownup" "$HOME/Library/LaunchAgents"
cp "$here/video_scheduler.js" "$dest/"
cp "$here/show.sh" "$dest/show"
chmod 755 "$dest/show"

if is_loaded && cmp -s "$new_plist" "$plist"; then
  # Same launch settings, so the job definition stays loaded and only the
  # process is restarted. kickstart -k stops the running copy and starts a
  # new one (which reads the new script) in one step: nothing to race.
  launchctl kickstart -k "$service"
  echo "Scheduler restarted."
else
  # New or changed launch settings: the job has to be unloaded and loaded again.
  if is_loaded; then
    launchctl bootout "$service" 2>/dev/null || true
    wait_until_unloaded
  fi
  install -m 644 "$new_plist" "$plist"
  # A job switched off with `launchctl disable` can't be loaded; switch it on.
  launchctl enable "$service"
  launchctl bootstrap "$domain" "$plist"
  echo "Scheduler started."
fi

echo "Installed. Log: $dest/scheduler.log"
echo "Put videos in:"
echo "  $dest/kid"
echo "  $dest/grownup"
echo "They're picked up within a few seconds; no restart needed."
echo
echo "Override the schedule with: $dest/show"
if ! grep -qs "video-scheduler/show" "$HOME/.zshrc"; then
  echo "To type just 'show', run this once and open a new Terminal window:"
  echo "  echo \"alias show='$dest/show'\" >> ~/.zshrc"
fi
if [ -f "$dest/current.mp4" ]; then
  echo
  echo "Note: $dest/current.mp4 is no longer used."
  echo "Move it into kid/ or grownup/, for example:"
  echo "  mv \"$dest/current.mp4\" \"$dest/grownup/\""
fi
