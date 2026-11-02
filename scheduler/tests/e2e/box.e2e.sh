#!/bin/bash
# End-to-end rehearsal of the box, on the box's own OS but without the Pi:
# Raspberry Pi OS Lite (64-bit) is Debian 13 (trixie) on arm64 with the
# Raspberry Pi archive, so this builds that in Docker, then does what the
# person does: clone, `sudo bash scheduler/setup.sh`, use the website. It
# runs the real setup, sync, player, website and mpv (drawing frames to
# images, as there is no TV), and checks each step. See inside.sh.
#
#   bash scheduler/tests/e2e/box.e2e.sh
#
# Needs Docker. On a machine that isn't arm64, it turns on arm64 emulation
# (tonistiigi/binfmt, which needs --privileged) and runs slowly: allow
# 10-15 minutes the first time, a few minutes after that.
# TVBOX_E2E_PLATFORM=linux/amd64 skips emulation: faster, but not the box's
# CPU.
#
# What it can't check, because it needs the Pi: the picture on the TV, smooth
# playback at full size, mpv's output straight to the screen, systemd
# starting things at boot, and the network.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
platform="${TVBOX_E2E_PLATFORM:-linux/arm64}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running. Start it (e.g. dockerd &) and try again." >&2
  exit 2
fi
if [ "$platform" = linux/arm64 ] && [ "$(uname -m)" != aarch64 ] && [ "$(uname -m)" != arm64 ] &&
  [ ! -e /proc/sys/fs/binfmt_misc/qemu-aarch64 ]; then
  echo "== Turning on arm64 emulation"
  [ -e /proc/sys/fs/binfmt_misc/register ] || mount -t binfmt_misc binfmt_misc /proc/sys/fs/binfmt_misc
  docker run --rm --privileged tonistiigi/binfmt --install arm64 >/dev/null
fi

echo "== Building the box-like image ($platform; slow the first time)"
docker build -q --platform "$platform" -t tvbox-e2e "$here" >/dev/null

docker run --rm --platform "$platform" \
  -v "$repo:/src:ro" \
  -v "$here/fakes:/opt/e2e-fakes:ro" \
  -v "$here/inside.sh:/opt/inside.sh:ro" \
  tvbox-e2e bash /opt/inside.sh
