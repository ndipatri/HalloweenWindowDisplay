## Context

See proposal.md - Why. `--hwdec=auto-safe` lets mpv try each hardware decoder it knows. On the Pi 5, the H.264 candidates (Vulkan video, CUDA) all fail, and mpv falls back to software decoding. Software decoding of the 1080 × 1920, 24 fps H.264 videos plays fine on the box.

## Goals / Non-Goals

**Goals:**
- No hardware-decoder errors in the log.
- The same playback as now.

**Non-Goals:**
- Hardware decoding. That would need the videos re-encoded to HEVC, the one format the Pi 5 decodes in hardware.

## Decisions

- **`--hwdec=no`.** It's what mpv ends up doing anyway, without the attempts. Rejected:
  - hiding the lines with `--msg-level` for ffmpeg, which would also hide real decoding errors;
  - `--hwdec=drm`, Raspberry Pi's hardware path, which only applies to HEVC.

  If the videos move to HEVC, `--hwdec=drm` is the setting to use; the comment in `mpv.js` says so.

## Risks / Trade-offs

- [Software decoding uses CPU] → It already was, after every failed attempt. Nothing changes for playback.

## Getting it onto the box

Rerun setup after merging: `ssh tvbox.local`, then `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Box-only check: the log (`tail -f ~/video-scheduler/scheduler.log`, or Recent activity on the website) shows `thanksgiving: playing …` lines and no `libcuda`, `vulkan` or `hwaccel` lines.

Rehearsal coverage: this change touches `mpv.js`, which the rehearsal runs, and its checks keep passing. The rehearsal can't show the probing itself: there, mpv draws to images, never tries hardware decoding, and never logged these lines. So the check is on the box.
