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

echo "== The repo the box will clone, with small test clips for videos"
TESTREPO="$E/testrepo"
cp -a /src "$TESTREPO"
rm -rf "$TESTREPO/.git" "$TESTREPO/playlists"/*/
mkdir -p "$TESTREPO/playlists/halloween/grownup"
clip() { # file colour: 2 s, portrait, H.264 like the real videos
  ffmpeg -loglevel error -f lavfi -i "color=c=$2:s=108x192:d=2" -r 24 -pix_fmt yuv420p "$1"
}
clip "$TESTREPO/playlists/halloween/a.mp4" orange
clip "$TESTREPO/playlists/halloween/b.mp4" purple
clip "$TESTREPO/playlists/halloween/grownup/c.mp4" lime
echo "not a video" > "$TESTREPO/playlists/halloween/broken.mp4"
# A repo folder with the uploads' name, which sync must leave alone.
mkdir -p "$TESTREPO/playlists/photos"
clip "$TESTREPO/playlists/photos/x.mp4" white
# The copy keeps the Mac's file owner, which git (run as root here) would
# otherwise refuse as "dubious ownership".
git config --system --add safe.directory '*'
git -C "$TESTREPO" init -q -b main && git -C "$TESTREPO" add -A && \
  git -C "$TESTREPO" -c user.name=e2e -c user.email=e2e@example.com commit -qm e2e
chown -R pi: "$TESTREPO"

echo "== A card's first-boot files, made by cards/ (as make-cards.js does)"
mkdir -p "$E/card"
node -e '
  const cards = require("/src/cards/cloud-init.js");
  const fs = require("fs");
  const files = cards.buildCard(cards.prepareAnswers({
    user: "pi", password: "rehearsal password", timezone: "America/New_York", sshKey: null,
    wifi: { ssid: "Pumpkin Patch", password: "hunter22", country: "US" },
    repoUrl: process.argv[1] }), "tvbox");
  for (const [f, text] of Object.entries(files)) fs.writeFileSync("/tmp/e2e/card/" + f, text);
' "$TESTREPO"
check "cloud-init accepts the card's user-data" \
  bash -c "cloud-init schema --config-file '$E/card/user-data' > '$E/schema.out' 2>&1 || { cat '$E/schema.out'; false; }"
check "cloud-init accepts the card's network-config" \
  bash -c "cloud-init schema --schema-type network-config --config-file '$E/card/network-config' > '$E/schema.out' 2>&1 || { cat '$E/schema.out'; false; }"
# What cloud-init's write_files does with the card's user-data on first boot.
python3 - "$E/card/user-data" <<'PY'
import os, sys, yaml
for f in yaml.safe_load(open(sys.argv[1]))["write_files"]:
    os.makedirs(os.path.dirname(f["path"]), exist_ok=True)
    open(f["path"], "w").write(f["content"])
    os.chmod(f["path"], int(f.get("permissions", "0644"), 8))
PY
check "the card installs the first-boot script, its settings and its service" \
  test -x /usr/local/sbin/tvbox-firstboot -a -f /etc/tvbox/firstboot.conf -a -f /etc/systemd/system/tvbox-firstboot.service
check "systemd accepts the first-boot service" \
  bash -c "! systemd-analyze verify --man=no /etc/systemd/system/tvbox-firstboot.service 2>&1 | grep -v 'Failed to determine\|Running in a container' | grep -q ."

echo "== First boot: tvbox-firstboot (clones the repo, runs sudo bash scheduler/setup.sh)"
env PATH="/opt/e2e-fakes:$PATH" TVBOX_FIRSTBOOT_DONE="$E/firstboot-done" /usr/local/sbin/tvbox-firstboot > "$E/setup.out" 2>&1
setup_status=$?
sed 's/^/   /' "$E/setup.out"
check "a card's first-boot script installs, clones and sets up the box" \
  test $setup_status -eq 0 -a -f "$E/firstboot-done" -a -d "$REPO/.git"
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
check "setup's first sync pulls the latest from the repo" logged "Pulled the latest from GitHub"
check "setup installs the log rule, and logrotate accepts it" \
  bash -c "test -f /etc/logrotate.d/tvbox && ! logrotate -d /etc/logrotate.d/tvbox 2>&1 | grep -qi 'error'"

check "setup's first sync brings the GitHub filters, owned by pi, and no custom ones" \
  bash -c "test \"\$(stat -c %U '$VIDEOS/github-filters.json')\" = pi && grep -q 'Halloween grownup' '$VIDEOS/github-filters.json' && test ! -e '$VIDEOS/filters.json' && logged 'Updated the GitHub filters.'"

echo "== Adding photos: first boot sets no PIN; setup run again with one"
check "first boot, with no one to ask, leaves adding photos off and says so" \
  bash -c "grep -q 'No upload PIN set, so adding photos is off' '$E/setup.out' && test ! -e '$VIDEOS/upload-pin'"
check "setup makes the photos folder" test -d "$VIDEOS/photos"
check "sync skips the repo's playlists/photos" \
  bash -c "logged 'Skipping playlists/photos: that name is kept for uploads from the website.' && test ! -e '$VIDEOS/photos/x.mp4'"
env PATH="/opt/e2e-fakes:$PATH" SUDO_USER=pi TVBOX_UPLOAD_PIN=4321 bash "$REPO/scheduler/setup.sh" < /dev/null > "$E/setup2.out" 2>&1
check "setup run again with TVBOX_UPLOAD_PIN saves it, readable only by pi" \
  bash -c "[ \"\$(cat '$VIDEOS/upload-pin')\" = 4321 ] && [ \"\$(stat -c '%a %U' '$VIDEOS/upload-pin')\" = '600 pi' ]"

echo "== The player, as tvbox.service runs it (website on 8080 instead of 80)"
# What systemd would provide: /run/tvbox, and the clock set from the network.
mkdir -p /run/tvbox && chown pi: /run/tvbox
touch "$E/clock-set"
sed -i -e "s|webPort: 80,|webPort: 8080,|" -e "s|clockFile: '/run/systemd/timesync/synchronized',|clockFile: '$E/clock-set',|" /opt/tvbox/config.js
sudo -u pi -H env PATH="/opt/e2e-fakes:/usr/bin:/bin" node /opt/tvbox/player.js >> "$LOG" 2>&1 &
player=$!

check "the player starts and logs its filters" within 90 logged "Filters: Halloween kid, Halloween grownup, Thanksgiving"
check "the website answers with a status" within 60 bash -c "[ -n \"\$(curl -fsS $SITE/api/status 2>/dev/null)\" ]"
check "the website page loads" bash -c "curl -fsS $SITE/ | grep -q 'Back to schedule'"

echo "== Using the website: Halloween grownup, until switched back"
echo "   $(post /api/show '{"filters":["Halloween grownup"],"until":"cleared"}')"
check "the status follows the website" within 20 bash -c '[ "$(status)" = "Halloween grownup (override until cleared)" ]'
check "mpv plays the first video" within 90 logged "Halloween grownup: playing a.mp4"
check "mpv moves on to the next videos" within 120 logged "Halloween grownup: playing c.mp4"
check "the broken video is skipped and logged once" \
  bash -c "[ \$(grep -c 'ERROR: Skipping broken.mp4 in Halloween grownup' '$LOG') -eq 1 ]"
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
check "rotating keeps the old log as scheduler.log.1" grep -q "Filters: " "$VIDEOS/scheduler.log.1"
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

echo "== Photos and videos added from a phone"
upload() { # file name pin -> the website's answer
  curl -sS -X POST -H "X-Upload-Pin: $3" --data-binary "@$1" "$SITE/api/uploads?name=$2"
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
# A plain portrait photo, a photo stored sideways with EXIF orientation 6
# (turn 90° clockwise to show it), a PNG whose top half is see-through, and
# an HEVC clip as a phone records.
ffmpeg -loglevel error -f lavfi -i "color=c=red:s=96x160" -frames:v 1 "$E/red.jpg"
ffmpeg -loglevel error -f lavfi -i "color=c=green:s=160x96" -frames:v 1 "$E/sideways-plain.jpg"
node -e '
  // Insert an APP1 Exif segment (orientation 6) right after the JPEG start.
  const fs = require("fs");
  const jpg = fs.readFileSync(process.argv[1]);
  const tiff = Buffer.from([0x4d,0x4d,0,0x2a, 0,0,0,8, 0,1, 0x01,0x12, 0,3, 0,0,0,1, 0,6,0,0, 0,0,0,0]);
  const body = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body]);
  fs.writeFileSync(process.argv[2], Buffer.concat([jpg.subarray(0, 2), app1, jpg.subarray(2)]));
' "$E/sideways-plain.jpg" "$E/sideways.jpg"
ffmpeg -loglevel error -f lavfi -i "color=c=blue:s=96x160,format=rgba,geq=r=0:g=0:b=255:a='if(lt(Y,80),0,255)'" -frames:v 1 "$E/half.png"
hevc_ok=0
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx265; then
  ffmpeg -loglevel error -f lavfi -i "color=c=yellow:s=108x192:d=2" -r 24 -c:v libx265 -tag:v hvc1 -pix_fmt yuv420p "$E/hevc.mp4" && hevc_ok=1
fi

check "a batch check with the wrong PIN is refused (403)" \
  test "$(code -X POST -H 'X-Upload-Pin: 1111' -d '{"files":[{"name":"a.jpg","bytes":10}]}' "$SITE/api/uploads/check")" = 403
check "a batch check with the right PIN is ready" \
  bash -c "curl -sS -X POST -H 'X-Upload-Pin: 4321' -d '{\"files\":[{\"name\":\"a.jpg\",\"bytes\":10}]}' '$SITE/api/uploads/check' | grep -q 'Ready to add 1 file.'"
echo "   $(upload "$E/red.jpg" Red.JPG 4321)"
check "an upload with the right PIN is added and logged" \
  bash -c "test -f '$VIDEOS/photos/00001-red.jpg' && logged 'Uploaded photos/00001-red.jpg'"
echo "   $(upload "$E/sideways.jpg" Sideways.jpg 4321)"
echo "   $(upload "$E/half.png" Half.png 4321)"
[ $hevc_ok -eq 1 ] && echo "   $(upload "$E/hevc.mp4" Phone.mp4 4321)"
check "the website lists the uploads in order" bash -c "
  curl -fsS $SITE/api/uploads | node -e '
    const d = JSON.parse(require(\"fs\").readFileSync(0));
    const names = d.uploads.map((u) => u.name);
    process.exit(d.pinSet && names[0] === \"00001-red.jpg\" && names[1] === \"00002-sideways.jpg\" && names[2] === \"00003-half.png\" ? 0 : 1);'"
check "the website sends an upload with a range" \
  test "$(code -H 'Range: bytes=0-9' "$SITE/photos/00001-red.jpg")" = 206

echo "   $(post /api/show '{"tags":["upload"],"until":"cleared"}')"
check "the upload tag shows in the status" within 20 bash -c '[ "$(status)" = "#upload (override until cleared)" ]'
check "the uploads play in order" within 60 logged "#upload: playing 00002-sideways.jpg"
check "each photo stays on screen about 10 seconds" node -e '
  const log = require("fs").readFileSync(process.argv[1], "utf8").split("\n");
  const when = (name) => { const l = log.find((x) => x.includes("#upload: playing " + name)); return l && Date.parse(l.split("  ")[0]); };
  const gap = (when("00002-sideways.jpg") - when("00001-red.jpg")) / 1000;
  console.log("   red.jpg to sideways.jpg: " + gap + " s");
  process.exit(gap >= 8 && gap <= 15 ? 0 : 1);' "$LOG"
check "the see-through PNG plays" within 30 logged "#upload: playing 00003-half.png"
if [ $hevc_ok -eq 1 ]; then
  check "the HEVC clip plays" within 60 logged "#upload: playing 00004-phone.mp4"
  sleep 3
  check "the HEVC clip isn't skipped" bash -c "! grep -q 'ERROR: Skipping 00004-phone.mp4' '$LOG'"
else
  echo "   (this ffmpeg has no libx265: no HEVC clip to try)"
fi
check "no hardware-decoder probing errors are logged" bash -c "! grep -qi 'libcuda\|vulkan' '$LOG'"
# Frames by colour: what each upload looked like on the turned screen.
frames_like() { # r g b -> sizes of frames near that colour
  for f in "$E/frames"/*.png; do
    c="$(ffmpeg -loglevel error -i "$f" -vf scale=1:1 -f rawvideo -pix_fmt rgb24 - | od -An -tu1 | xargs)"
    node -e "const [r,g,b]='$c'.split(' ').map(Number);const [R,G,B]=[$1,$2,$3];process.exit(Math.abs(r-R)+Math.abs(g-G)+Math.abs(b-B)<70?0:1)" &&
      ffprobe -v error -select_streams v -show_entries stream=width,height -of csv=p=0 "$f"
  done | sort -u
}
sideways="$(frames_like 0 128 0)"
echo "   the sideways photo's frames: ${sideways:-none}"
check "a photo stored sideways (EXIF orientation 6) comes out upright (160 x 96, like the plain one)" \
  bash -c "[ -n '$sideways' ] && ! echo '$sideways' | grep -qv '^160,96$'"
# Black behind the see-through PNG is box-only: without the TV's GPU output
# mpv ignores --background, so the rehearsal only checks that it plays.
if [ $hevc_ok -eq 1 ]; then
  check "the HEVC clip draws frames" test -n "$(frames_like 255 255 0)"
fi

# Remove a photo just after it comes on, so it has most of its 10 seconds
# left: if the next one starts within 5 seconds, the removal moved mpv on.
lines=$(grep -c '#upload: playing' "$LOG")
within 15 bash -c "[ \$(grep -c '#upload: playing' '$LOG') -gt $lines ]"
playing="$(grep -o '#upload: playing [^ ]*' "$LOG" | tail -1 | cut -d' ' -f3)"
errors_before=$(grep -c 'ERROR' "$LOG")
echo "   removing $playing: $(curl -sS -X POST -H 'X-Upload-Pin: 4321' -d "{\"name\":\"$playing\"}" "$SITE/api/uploads/remove")"
check "removing the upload on screen deletes it and logs it" \
  bash -c "test ! -e '$VIDEOS/photos/$playing' && logged 'Removed photos/$playing (from the website)'"
check "the next upload comes on at once after the removed one" within 5 bash -c "
  tail -n +\$(grep -n 'Removed photos/$playing' '$LOG' | tail -1 | cut -d: -f1) '$LOG' | grep '#upload: playing' | grep -qv '$playing'"
# A full round of the uploads left, so a stale queue entry would be reached.
sleep 35
check "removing it logs no error, even a round later" test "$(grep -c 'ERROR' "$LOG")" -eq "$errors_before"
echo "   $(post /api/schedule '{}')"
uploads_before="$(ls -A "$VIDEOS/photos")"

echo "== Tags and filters"
up1="$(ls "$VIDEOS/photos" | head -1)"
up2="$(ls "$VIDEOS/photos" | sed -n 2p)"
echo "   $(post /api/tags "{\"path\":\"photos/$up1\",\"add\":\"favorites\"}")"
echo "   $(post /api/tags "{\"path\":\"photos/$up2\",\"add\":\"favorites\"}")"
check "tagging writes the box's tags and logs them" \
  bash -c "grep -q 'photos/$up1' '$VIDEOS/tags.json' && logged 'Tags: photos/$up1 + favorites (from the website).'"
check "the website lists the uploads with their tags" bash -c "
  curl -fsS $SITE/api/items | node -e '
    const d = JSON.parse(require(\"fs\").readFileSync(0));
    const u = d.items.find((i) => i.path === \"photos/$up1\");
    process.exit(u && u.boxTags.join() === \"favorites\" && d.items.every((i) => i.path.startsWith(\"photos/\")) ? 0 : 1);'"
github_code="$(curl -s -o /dev/null -w '%{http_code}' -X POST -d '{"path":"halloween/grownup/c.mp4","add":"favorites"}' "$SITE/api/tags")"
check "a video from GitHub can't be tagged" test "$github_code" = 400
errors_before=$(grep -c 'ERROR' "$LOG")
echo "   $(post /api/show '{"tags":["favorites"],"until":"cleared"}')"
check "the favorites tag shows in the status" within 20 bash -c '[ "$(status)" = "#favorites (override until cleared)" ]'
check "Favorites plays the first favorite" within 30 logged "#favorites: playing $up1"
check "Favorites plays the next favorite" within 30 logged "#favorites: playing $up2"
# Untag whatever is on screen: the other favorite comes on at once.
on_screen="$(grep -o '#favorites: playing [^ ]*' "$LOG" | tail -1 | cut -d' ' -f3)"
if [ "$on_screen" = "$up1" ]; then next="$up2"; else next="$up1"; fi
lines=$(grep -c "#favorites: playing $next" "$LOG")
echo "   $(post /api/tags "{\"path\":\"photos/$on_screen\",\"remove\":\"favorites\"}")"
check "untagging the item on screen moves on to the next favorite" \
  within 8 bash -c "[ \$(grep -c '#favorites: playing $next' '$LOG') -gt $lines ]"
check "Favorites logs no error" test "$(grep -c 'ERROR' "$LOG")" -eq "$errors_before"
echo "   $(post /api/show '{"tags":["favorites"],"filters":["Halloween grownup"],"until":"cleared"}')"
check "a tag and a filter play together" within 20 bash -c '[ "$(status)" = "#favorites + Halloween grownup (override until cleared)" ]'
check "the mix plays the filter's video too" within 60 logged "#favorites + Halloween grownup: playing c.mp4"
echo "   $(post /api/schedule '{}')"
saved="$(curl -sS -X POST -H 'X-Upload-Pin: 4321' -H 'Content-Type: application/json' \
  -d '{"filters":[{"name":"Rehearsal","anyOf":["halloween"],"schedule":[{"from":"01-01","to":"12-31"}]}]}' \
  "$SITE/api/filters")"
echo "   $saved"
check "a saved custom filter comes first among the choices" bash -c "
  curl -fsS $SITE/api/choices | node -e '
    const d = JSON.parse(require(\"fs\").readFileSync(0));
    process.exit(d.filters.join() === \"Rehearsal,Halloween kid,Halloween grownup,Thanksgiving\" ? 0 : 1);'"
clash_code="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'X-Upload-Pin: 4321' -d '{"filters":[{"name":"Thanksgiving","anyOf":["favorites"],"schedule":[{"from":"01-01","to":"12-31"}]}]}' "$SITE/api/filters")"
check "a custom filter can't take a GitHub filter's name" test "$clash_code" = 400
check "a filter scheduled all year plays" within 20 bash -c '[ "$(status)" = "Rehearsal (scheduled all day)" ]'

echo "== Check for new videos now, and the recent activity"
syncs_before=$(grep -c "sync: Done:" "$LOG")
echo "   $(post /api/sync '{}')"
check "Check for new videos now starts a sync that finishes in the log" \
  within 60 bash -c "[ \$(grep -c 'sync: Done:' '$LOG') -gt $syncs_before ]"
check "Check for new videos now leaves the uploads alone" test "$(ls -A "$VIDEOS/photos")" = "$uploads_before"
check "the website shows the log's last lines" bash -c "
  curl -fsS $SITE/api/log | node -e '
    const l = JSON.parse(require(\"fs\").readFileSync(0)).lines;
    process.exit(l.length > 0 && l.length <= 20 && l.some((x) => x.includes(\"sync: Done:\")) ? 0 : 1);'"
# Hold the sync lock as a running sync would, then start another.
sudo -u pi bash -c 'exec 9>/home/pi/video-scheduler/.sync.lock; flock 9; sleep 20' &
holder=$!
sleep 1
sudo -u pi -H /home/pi/video-scheduler/sync >> "$LOG" 2>&1
check "a second sync while one runs is skipped" logged "Skipped: another sync is already running."
kill $holder 2>/dev/null; pkill -u pi -x sleep 2>/dev/null

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
