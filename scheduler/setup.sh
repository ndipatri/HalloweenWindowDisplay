#!/bin/bash
# Sets up the box, or updates it after a change to scheduler/. Run on the
# Raspberry Pi, from the repo, as your own user with sudo:
#
#   cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh
#
# Safe to run again. It:
#   - installs mpv, Node.js, git, logrotate, gpiod (for a tilt switch) and
#     qrencode (for the address code on the TV)
#   - lets your user use the screen (video and render groups)
#   - sets the time zone and turns on network time
#   - copies the player and website to /opt/tvbox
#   - installs the video sync as ~/video-scheduler/sync
#   - sets up adding photos on the website: the photos folder (no PIN:
#     anyone on the home Wi-Fi can add them; an old upload-pin file goes)
#   - keeps the log from growing forever (/etc/logrotate.d/tvbox)
#   - installs and starts tvbox.service (player and website) and
#     tvbox-sync.timer (sync a minute after boot, then hourly)
#
# Settings (environment): TVBOX_TIMEZONE (default America/New_York).
# For testing only: TVBOX_ROOT (a folder that stands in for /), TVBOX_USER
# and TVBOX_HOME.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(dirname "$here")"
root="${TVBOX_ROOT:-}"
timezone="${TVBOX_TIMEZONE:-America/New_York}"

if [ -z "$root" ] && [ "$(id -u)" -ne 0 ]; then
  echo "Run it with sudo: sudo bash scheduler/setup.sh" >&2
  exit 1
fi
user="${TVBOX_USER:-${SUDO_USER:-}}"
if [ -z "$user" ] || [ "$user" = root ]; then
  echo "Run it with sudo from your own user (not as root), so the box runs as you." >&2
  exit 1
fi
home="${TVBOX_HOME:-$(getent passwd "$user" | cut -d: -f6)}"
app="$root/opt/tvbox"
units="$root/etc/systemd/system"
videos="$home/video-scheduler"

say() { echo "==> $*"; }
owned() { [ -n "$root" ] || chown -R "$user:" "$@"; }

say "Installing mpv, Node.js, git, logrotate, gpiod and qrencode"
apt-get update -qq
apt-get install -y -qq mpv nodejs git logrotate gpiod qrencode >/dev/null
major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 18 ]; then
  echo "Node.js $major is too old; the box needs 18 or later." >&2
  exit 1
fi

say "Letting $user use the screen and read the tilt switch"
# video: the display; render: the GPU; gpio: the pins, for a tilt switch.
# Raspberry Pi OS normally has all three, but tvbox.service asks for them,
# and systemd won't start it if one is missing, so make sure they exist.
for group in video render gpio; do
  getent group "$group" >/dev/null || groupadd --system "$group"
done
usermod -aG video,render,gpio "$user"

say "Setting the time zone to $timezone and turning on network time"
timedatectl set-timezone "$timezone"
timedatectl set-ntp true

say "Copying the player and website to /opt/tvbox"
mkdir -p "$app"
for f in config.js logic.js mpv.js media_size.js player.js tilt.js address_code.js website.js; do
  cp "$here/$f" "$app/$f"
done

say "Installing the video sync as ~/video-scheduler/sync"
mkdir -p "$videos"
sed "s|__REPO__|$repo|" "$here/sync_videos.sh" > "$videos/sync"
chmod +x "$videos/sync"
touch "$videos/scheduler.log"

say "Setting up adding photos on the website"
mkdir -p "$videos/photos"
# Adding photos needs no PIN any more: the one an older setup saved goes.
if [ -f "$videos/upload-pin" ]; then
  rm -f "$videos/upload-pin"
  echo "    The upload PIN is no longer used, so it was removed."
fi

owned "$videos"

say "Keeping the log from growing forever"
mkdir -p "$root/etc/logrotate.d"
sed -e "s|__USER__|$user|g" -e "s|__HOME__|$home|g" "$here/logrotate/tvbox" > "$root/etc/logrotate.d/tvbox"
chmod 644 "$root/etc/logrotate.d/tvbox"

say "Installing the services"
mkdir -p "$units"
for unit in tvbox.service tvbox-sync.service tvbox-sync.timer; do
  sed -e "s|__USER__|$user|g" -e "s|__HOME__|$home|g" -e "s|__APP__|/opt/tvbox|g" \
    "$here/systemd/$unit" > "$units/$unit"
done
systemctl daemon-reload
systemctl enable tvbox.service tvbox-sync.timer

say "Syncing the videos (this can take a minute the first time)"
systemctl start tvbox-sync.service || echo "    The sync had a problem; see ~/video-scheduler/scheduler.log. Carrying on."
systemctl start tvbox-sync.timer

say "Starting the player"
systemctl restart tvbox.service

name="$(hostname)"
echo
echo "Done. The website is at http://$name.local/"
echo "What it's doing: tail ~/video-scheduler/scheduler.log"
