# Tasks

## 1. Photos fill the screen

- [x] 1.1 `keepPlaying` queues a photo with `loadfile <path> append-play -1 panscan=1.0` and a video as before; the fake mpv keeps per-item options. Verify: "each photo fills the screen and each video is fitted whole" in `player.test.js` passes, and fails with the change reverted.
- [x] 1.2 The rehearsal checks mpv's `panscan` is 1 while a photo plays (real mpv 0.40 takes the per-item option). Verify: the rehearsal passes.
- [x] 1.3 README, the window-display-schedule skill and `mpv.js`'s comment say photos fill the screen and videos are fitted whole. Verify: the text.

## 2. Verification

- [x] 2.1 All tests pass on Linux and every scenario has its test. Verify: the commands' output.

## Workflow follow-up

- The emulator can't show this (its TV view grabs the video frame before panscan crops it); the rehearsal checks mpv's panscan with real mpv instead.
- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`, then look at a photo on the TV.
