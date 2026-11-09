## Why

On the first real box, every video start logged five error-looking lines:
- `Cannot load libcuda.so.1`, and `Could not dynamically load CUDA`;
- `Device does not support the VK_KHR_video_decode_queue extension!`;
- `Failed setup for format vulkan: hwaccel initialisation returned error`.

That's mpv trying hardware video decoders before falling back to software. The Raspberry Pi 5 has no hardware decoder for H.264, which the videos are in, so every attempt fails and software decoding plays them fine. But the lines come roughly every 20 seconds all evening. They crowd the log and the website's Recent activity, where a real problem would be easy to miss.

## What Changes

- mpv is started with `--hwdec=no` instead of `--hwdec=auto-safe`, so it decodes in software straight away, which is what it was doing after the failed attempts anyway.
- A troubleshooting row in the schedule skill for these lines on a box still running the old setting.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- None. What plays, and every line the box itself logs, is unchanged; only mpv's own probing noise goes. So this change sets `skip_specs: true`.

## Impact

- `scheduler/mpv.js` (one option) and `.claude/skills/window-display-schedule/SKILL.md`.
- On the box: rerun setup.

## On-box results so far

The first box, set up from a card made by `cards/make-cards.js`, works:
- its picture is the right way up (`rotate: 90`);
- it plays the Thanksgiving videos;
- the website answers.

These were on-box checks from replace-mac-with-pi-box and make-tvbox-cards.
