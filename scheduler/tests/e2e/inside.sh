#!/bin/bash
# The end-to-end rehearsal itself, run as root inside the box-like container
# by box.e2e.sh. The repo is mounted read-only at /src, the fakes at
# /opt/e2e-fakes. Prints PASS/FAIL per check; exits 1 if any failed.
set -uo pipefail

E=/tmp/e2e
REPO=/home/pi/HalloweenWindowDisplay
VIDEOS=/home/pi/video-scheduler
LOG=$VIDEOS/scheduler.log
SITE=http://localhost:8080
mkdir -p "$E/frames" && chmod 777 "$E" "$E/frames" && : > "$E/calls"

passed=0
failed=0
check() { # name command...
  local name="$1"; shift
  if "$@"; then echo "PASS  $name"; passed=$((passed + 1));
  else echo "FAIL  $name"; failed=$((failed + 1)); fi
}
# Waits up to $1 seconds for a command to succeed.
within() {
  local end=$((SECONDS + $1)); shift
  until "$@"; do [ $SECONDS -ge $end ] && return 1; sleep 1; done
}
status() { curl -fsS "$SITE/api/status" | node -pe 'JSON.parse(require("fs").readFileSync(0)).status'; }
post() { curl -sS -X POST -H 'Content-Type: application/json' -d "$2" "$SITE$1"; }
logged() { grep -qF -- "$1" "$LOG"; }
export SITE LOG
export -f status logged

echo "== The box's software"
echo "   $(. /etc/os-release; echo "$PRETTY_NAME"), $(uname -m)"
echo "   node $(node -v), $(mpv --version | head -1 | cut -d' ' -f1-2), ffmpeg $(dpkg-query -W -f='${Version}' ffmpeg)"

echo "== The repo, as the person clones it, with small test clips for videos"
cp -a /src "$REPO"
rm -rf "$REPO/.git" "$REPO/playlists"/*/
mkdir -p "$REPO/playlists/halloween/grownup"
clip() { # file colour: 2 s, portrait, H.264 like the real videos
  ffmpeg -loglevel error -f lavfi -i "color=c=$2:s=108x192:d=2" -r 24 -pix_fmt yuv420p "$1"
}
clip "$REPO/playlists/halloween/a.mp4" orange
clip "$REPO/playlists/halloween/b.mp4" purple
clip "$REPO/playlists/halloween/grownup/c.mp4" lime
echo "not a video" > "$REPO/playlists/halloween/broken.mp4"
# Its own git repo with no remote, so sync's pull fails fast, as offline.
git -C "$REPO" init -q && git -C "$REPO" add -A && \
  git -C "$REPO" -c user.name=e2e -c user.email=e2e@example.com commit -qm e2e
chown -R pi: "$REPO"

echo "== sudo bash scheduler/setup.sh"
(cd "$REPO" && env PATH="/opt/e2e-fakes:$PATH" SUDO_USER=pi bash scheduler/setup.sh) > "$E/setup.out" 2>&1
setup_status=$?
sed 's/^/   /' "$E/setup.out"
check "setup finishes without an error" test $setup_status -eq 0
if [ $setup_status -ne 0 ]; then
  echo; echo "$passed passed, $failed failed (stopped: nothing after setup can work)"
  exit 1
fi
check "setup copies the player and website to /opt/tvbox" \
  test -f /opt/tvbox/player.js -a -f /opt/tvbox/website.js -a -f /opt/tvbox/logic.js -a -f /opt/tvbox/mpv.js -a -f /opt/tvbox/config.js
check "setup installs and enables the three units" \
  grep -q "systemctl enable tvbox.service tvbox-sync.timer" "$E/calls"
check "systemd accepts the units" \
  bash -c "! systemd-analyze verify --man=no /etc/systemd/system/tvbox.service /etc/systemd/system/tvbox-sync.service /etc/systemd/system/tvbox-sync.timer 2>&1 | grep -v 'Failed to determine\|Running in a container\|Assignment outside' | grep -q ."
check "setup's first sync copies the videos over" \
  test -f "$VIDEOS/halloween/a.mp4" -a -f "$VIDEOS/halloween/grownup/c.mp4"
check "sync logs that GitHub can't be reached and carries on" bash -c "grep -q \"Couldn't pull\" '$LOG'"
check "setup installs the log rule, and logrotate accepts it" \
  bash -c "test -f /etc/logrotate.d/tvbox && ! logrotate -d /etc/logrotate.d/tvbox 2>&1 | grep -qi 'error'"

echo "== The player, as tvbox.service runs it (website on 8080 instead of 80)"
# What systemd would provide: /run/tvbox, and the clock set from the network.
mkdir -p /run/tvbox && chown pi: /run/tvbox
touch "$E/clock-set"
sed -i -e "s|webPort: 80,|webPort: 8080,|" -e "s|clockFile: '/run/systemd/timesync/synchronized',|clockFile: '$E/clock-set',|" /opt/tvbox/config.js
sudo -u pi -H env PATH="/opt/e2e-fakes:/usr/bin:/bin" node /opt/tvbox/player.js >> "$LOG" 2>&1 &
player=$!

check "the player starts and logs its seasons" within 90 logged "Seasons: "
check "the website answers with a status" within 60 bash -c "[ -n \"\$(curl -fsS $SITE/api/status 2>/dev/null)\" ]"
check "the website page loads" bash -c "curl -fsS $SITE/ | grep -q 'Back to schedule'"

echo "== Using the website: Halloween grownup, until switched back"
echo "   $(post /api/show '{"target":"halloween/grownup","until":"cleared"}')"
check "the status follows the website" within 20 bash -c '[ "$(status)" = "halloween/grownup (override until cleared)" ]'
check "mpv plays the first video" within 90 logged "halloween/grownup: playing a.mp4"
check "mpv moves on to the next videos" within 120 logged "halloween/grownup: playing c.mp4"
check "the broken video is skipped and logged once" \
  bash -c "[ \$(grep -c 'ERROR: Skipping broken.mp4 in halloween/grownup' '$LOG') -eq 1 ]"
frame="$(ls -t "$E/frames"/*.png 2>/dev/null | head -1)"
check "mpv draws frames" test -n "$frame"
if [ -n "$frame" ]; then
  size="$(ffprobe -v error -select_streams v -show_entries stream=width,height -of csv=p=0 "$frame")"
  colour="$(ffmpeg -loglevel error -i "$frame" -vf scale=1:1 -f rawvideo -pix_fmt rgb24 - | od -An -tu1 | xargs)"
  echo "   last frame: ${size/,/ x } pixels, colour (r g b) $colour"
  check "frames are turned 90° for the TV on its side (192 x 108 from a 108 x 192 clip)" test "$size" = "192,108"
  check "frames show one of the clips' colours" node -e "
    const [r, g, b] = '$colour'.split(' ').map(Number);
    const near = (c) => Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) < 90;
    process.exit([[255, 165, 0], [128, 0, 128], [0, 255, 0]].some(near) ? 0 : 1);"
fi

echo "== The log is rotated while the player runs"
logrotate -f /etc/logrotate.d/tvbox
check "rotating keeps the old log as scheduler.log.1" grep -q "Seasons: " "$VIDEOS/scheduler.log.1"
check "the new log starts empty" test "$(stat -c %s "$LOG")" -lt 2000

echo "== Black, then back to the schedule"
echo "   $(post /api/show '{"target":"black","until":"cleared"}')"
check "black shows in the status" within 20 bash -c '[ "$(status)" = "black (override until cleared)" ]'
check "after rotating, the player keeps writing to the log" within 20 logged "Now showing: black (override until cleared)"
check "the rotated log has no gap of empty bytes" bash -c "tr -d '\\000' < '$LOG' | cmp -s - '$LOG'"
sleep 3
before=$(ls "$E/frames" | wc -l); sleep 4; after=$(ls "$E/frames" | wc -l)
check "no frames are drawn while black" test "$before" -eq "$after"
echo "   $(post /api/schedule '{}')"
check "back to schedule removes the override" within 10 test ! -e "$VIDEOS/override.json"
check "the status leaves the override" within 20 bash -c '! status | grep -q override'

echo "== mpv stops"
pkill -x mpv
check "the player exits with code 1, so systemd would restart it" bash -c "
  for i in \$(seq 1 30); do kill -0 $player 2>/dev/null || break; sleep 1; done
  ! kill -0 $player 2>/dev/null"
wait "$player"; code=$?
check "exit code is 1" test "$code" -eq 1
check "it logs why" logged "ERROR: mpv stopped"

echo
echo "== The log"
sed 's/^/   /' "$LOG" | tail -40
echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
