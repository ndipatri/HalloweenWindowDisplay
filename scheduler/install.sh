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

mkdir -p "$dest" "$HOME/Library/LaunchAgents"
cp "$here/video_scheduler.js" "$dest/"
sed "s#__HOME__#$HOME#g" "$here/$label.plist" > "$plist"
chmod 644 "$plist"
plutil -lint "$plist"

# Stop any copy that is already running, then start this one.
launchctl bootout "$domain/$label" 2>/dev/null || true
launchctl bootstrap "$domain" "$plist"

echo "Installed. Log: $dest/scheduler.log"
if [ ! -f "$dest/current.mp4" ]; then
  echo "Next: copy your video to $dest/current.mp4"
  echo "      It starts within a few seconds; no restart needed the first time."
fi
