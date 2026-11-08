#!/bin/bash
# A tvBox you can use without the Pi: the box's own software (setup, sync,
# player, website, mpv) running on the box's OS in Docker, with the real
# videos from playlists/, until you press Ctrl-C.
#
#   bash scheduler/tests/e2e/emulate.sh
#
# Then open:
#   http://localhost:8080/  the box's website (as http://tvbox.local/)
#   http://localhost:8081/  the "TV": what mpv is showing, about twice a
#                           second (a slideshow of frames, no sound)
# A phone on the same Wi-Fi can use the Mac's name or address instead of
# localhost, e.g. http://<this-mac>.local:8080/, to try uploads, tags and filters.
#
# The upload PIN is 1234 (TVBOX_EMULATOR_PIN=5678 to change it). It runs the
# code as it is in this folder, uncommitted changes included, and sync pulls
# from this folder's current branch, never from GitHub. Nothing is kept:
# uploads, picks and the log go when it stops. The clock is the Mac's.
# Uses the same image as box.e2e.sh (see there for what it can't show).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
platform="${TVBOX_E2E_PLATFORM:-linux/arm64}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running. Start Docker Desktop and try again." >&2
  exit 2
fi
echo "== Building the box-like image ($platform; slow the first time)"
if ! docker build -q --platform "$platform" -t tvbox-e2e "$here" >/dev/null; then
  if docker image inspect tvbox-e2e >/dev/null 2>&1; then
    echo "   Couldn't rebuild it (offline?); using the one built before."
  else
    echo "Couldn't build the image, and there is none from before." >&2
    exit 1
  fi
fi

echo "== Starting the box (Ctrl-C stops it)"
tty=()
[ -t 0 ] && tty=(-it) # from a terminal, so Ctrl-C reaches it
exec docker run --rm ${tty[@]+"${tty[@]}"} --init --platform "$platform" \
  --name tvbox-emulator \
  -p 8080:8080 -p 8081:8081 \
  -e TZ="${TVBOX_TIMEZONE:-America/New_York}" \
  -e TVBOX_EMULATOR_PIN="${TVBOX_EMULATOR_PIN:-1234}" \
  -v "$repo:/src:ro" \
  -v "$here/fakes:/opt/e2e-fakes:ro" \
  -v "$here/emulator:/opt/emulator:ro" \
  tvbox-e2e bash /opt/emulator/inside.sh
