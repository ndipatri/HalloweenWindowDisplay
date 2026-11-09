# Tasks

## 1. The setting

- [x] 1.1 `scheduler/mpv.js`: `--hwdec=no` in place of `--hwdec=auto-safe`, with a comment on why and on `--hwdec=drm` for HEVC; verify `node --check`, and that no other file still names `auto-safe` (archived changes aside)
- [x] 1.2 Schedule skill: a troubleshooting row for the probing lines on a box still on the old setting

## 2. Verification

- [x] 2.1 Run every Node test file and verify they pass
- [x] 2.2 The change touches `mpv.js`, which the rehearsal runs: run `bash scheduler/tests/e2e/box.e2e.sh` and verify every check passes. It can't show the probing lines: mpv draws to images there and never logged them.
- [x] 2.3 Run `openspec validate quiet-hardware-decoding --strict` and verify it is valid

## Workflow follow-up

- On the box, after merging: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Then check that the log and Recent activity show `playing …` lines with no `libcuda`, `vulkan` or `hwaccel` lines, and that playback is still smooth.
- Archive this change after the box check.
