#!/bin/bash
# The emulator itself, run as root inside the box-like container by
# emulate.sh: sets the box up as a card's first boot would (from a copy of
# the repo at /src, with the real videos), then runs the player as
# tvbox.service does, the website on 8080, and the TV page on 8081.
set -euo pipefail

REPO=/home/pi/HalloweenWindowDisplay
VIDEOS=/home/pi/video-scheduler
mkdir -p /tmp/e2e /tmp/tv && chmod 777 /tmp/e2e /tmp/tv && : > /tmp/e2e/calls
ln -sf "/usr/share/zoneinfo/${TZ:-America/New_York}" /etc/localtime

echo "== Copying the repo as it is in your folder"
cp -a /src "$REPO"
# Sync pulls from your folder (its current branch), never from GitHub.
git -C "$REPO" remote set-url origin /src
git config --system --add safe.directory '*'
chown -R pi: "$REPO"

echo "== Running setup (sudo bash scheduler/setup.sh)"
if ! env PATH="/opt/emulator:/opt/e2e-fakes:$PATH" SUDO_USER=pi TVBOX_UPLOAD_PIN="$TVBOX_EMULATOR_PIN" \
    bash "$REPO/scheduler/setup.sh" < /dev/null > /tmp/e2e/setup.out 2>&1; then
  sed 's/^/   /' /tmp/e2e/setup.out
  echo "Setup failed; see above." >&2
  exit 1
fi
tail -3 /tmp/e2e/setup.out | sed 's/^/   /'

# What systemd would provide: /run/tvbox, and the clock set from the network.
mkdir -p /run/tvbox && chown pi: /run/tvbox
touch /tmp/e2e/clock-set
sed -i -e "s|webPort: 80,|webPort: 8080,|" \
  -e "s|clockFile: '/run/systemd/timesync/synchronized',|clockFile: '/tmp/e2e/clock-set',|" /opt/tvbox/config.js

sudo -u pi -H env PATH="/opt/emulator:/opt/e2e-fakes:/usr/bin:/bin" node /opt/tvbox/player.js >> "$VIDEOS/scheduler.log" 2>&1 &
node /opt/emulator/tv.js "$VIDEOS/status" /opt/tvbox/config.js &

cat <<MSG

   The box is running.
     Website:  http://localhost:8080/   (upload PIN $TVBOX_EMULATOR_PIN)
     TV:       http://localhost:8081/
   A phone on the same Wi-Fi can use this Mac's name instead of localhost.
   Ctrl-C stops it. The box's log follows:

MSG
exec tail -n +1 -F "$VIDEOS/scheduler.log"
