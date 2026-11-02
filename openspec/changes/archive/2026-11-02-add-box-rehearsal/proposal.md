## Why

The Node tests fake mpv, the clock and the file system, and the box itself hasn't arrived. Between the two, nothing checked that `setup.sh`, the units, sync, the player, the website and the real mpv work together on the software the box will actually run. The first rehearsal found a real problem straight away: setup failed where the `render` group didn't exist.

## What Changes

- `scheduler/tests/e2e/box.e2e.sh`, an end-to-end rehearsal on the box's own OS, in Docker. The OS is the latest Raspberry Pi OS Lite (64-bit): Debian 13 (trixie) on arm64 with the Raspberry Pi archive, so Node.js 20.19, mpv 0.40, and ffmpeg 7.1 from Raspberry Pi. The rehearsal runs the real `setup.sh`, sync, player, website and mpv (drawing frames to images, since there's no TV), and checks 23 things the person would see.
- `setup.sh` creates the `video` and `render` groups if they're missing, since `tvbox.service` asks for both and systemd won't start a service whose groups don't exist.
- The `window-display` schema, `openspec/config.yaml` and the window-display-schedule skill name the box's OS and its versions, and say when to run the rehearsal: whenever a change touches what it runs. They also say how a design names the rehearsal checks that cover a change.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- None. No display behaviour changes, so this change sets `skip_specs: true`. The rehearsal checks behaviour the specs already define, plus setup and the real mpv, which no spec covers because only the box's OS can run them.

## Impact

- New `scheduler/tests/e2e/`: `box.e2e.sh`, `inside.sh`, `Dockerfile`, and `fakes/` (`systemctl`, `timedatectl`, and an `mpv` wrapper that draws to PNGs).
- `scheduler/setup.sh`: the groups.
- `openspec/schemas/window-display/schema.yaml`, `openspec/config.yaml`, `.claude/skills/window-display-schedule/SKILL.md`.
- On the box: nothing new to do. Setup simply no longer fails if `render` is missing.
