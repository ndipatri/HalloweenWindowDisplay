#!/bin/bash
# The first boot of a tvbox card. cloud-init installs this as
# /usr/local/sbin/tvbox-firstboot, and tvbox-firstboot.service runs it as
# root until it succeeds once (it retries every minute, even after a reboot).
# It waits for the network, installs git, clones the repo for the user, and
# runs the repo's scheduler/setup.sh, which installs and starts the display.
# Settings come from /etc/tvbox/firstboot.conf (made by cards/make-cards.js):
#   TVBOX_USER, TVBOX_REPO_URL, TVBOX_TIMEZONE
# Its output goes to /var/log/tvbox-firstboot.log.
set -euo pipefail

conf="${TVBOX_FIRSTBOOT_CONF:-/etc/tvbox/firstboot.conf}"
done_file="${TVBOX_FIRSTBOOT_DONE:-/var/lib/tvbox/firstboot-done}"
# shellcheck source=/dev/null
. "$conf"

log() { echo "$(date '+%m/%d/%Y, %-I:%M:%S %p')  tvbox-firstboot: $*"; }

home="$(getent passwd "$TVBOX_USER" | cut -d: -f6)"
if [ -z "$home" ]; then
  log "ERROR: No user $TVBOX_USER yet. Trying again in a minute."
  exit 1
fi
repo="$home/tvBox"

# The network: wait for the repo's host when it's on the web (up to 10
# minutes; the service tries again after that).
case "$TVBOX_REPO_URL" in
  http://* | https://*)
    host="${TVBOX_REPO_URL#*://}"
    host="${host%%/*}"
    log "Waiting for the network ($host)"
    for _ in $(seq 1 120); do
      curl -fsS -m 10 -o /dev/null "https://$host" 2>/dev/null && break
      sleep 5
    done
    curl -fsS -m 10 -o /dev/null "https://$host" || { log "ERROR: Can't reach $host yet."; exit 1; }
    ;;
esac

if ! command -v git >/dev/null; then
  log "Installing git"
  apt-get update -qq
  apt-get install -y -qq git >/dev/null
fi

if [ ! -d "$repo/.git" ]; then
  log "Getting the display from $TVBOX_REPO_URL"
  rm -rf "$repo.partial"
  sudo -u "$TVBOX_USER" git clone -q "$TVBOX_REPO_URL" "$repo.partial"
  mv "$repo.partial" "$repo"
fi

log "Setting up the display"
SUDO_USER="$TVBOX_USER" TVBOX_TIMEZONE="${TVBOX_TIMEZONE:-America/New_York}" \
  bash "$repo/scheduler/setup.sh"

mkdir -p "$(dirname "$done_file")"
touch "$done_file"
log "Done. This box is set up; the website is at http://$(hostname).local/"
