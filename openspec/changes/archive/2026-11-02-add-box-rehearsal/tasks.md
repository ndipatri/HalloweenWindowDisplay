# Tasks

## 1. The box-like image

- [x] 1.1 Add `scheduler/tests/e2e/Dockerfile`: `debian:trixie`, the Raspberry Pi archive signed with the key from `raspberrypi-archive-keyring`, mpv, nodejs, git, ffmpeg, systemd, and a `pi` user; verify it builds for `linux/arm64` and reports Debian 13, aarch64, node v20.19.2, mpv v0.40.0, and ffmpeg `7.1.5-0+deb13u1+rpt2`
- [x] 1.2 Use the keyring package's key instead of `raspberrypi.gpg.key`; verify `apt-get update` accepts the archive (the old key failed with "SHA1 is not considered secure")

## 2. The rehearsal

- [x] 2.1 Add `fakes/systemctl`, `fakes/timedatectl` and `fakes/mpv` (wrapping the real mpv to draw PNGs); verify `bash -n` on each
- [x] 2.2 Add `inside.sh` (the person's steps and 23 checks) and `box.e2e.sh` (starts emulation if needed, builds, runs); verify a run reaches every check and stops right after setup if setup fails

## 3. Setup on the real OS

- [x] 3.1 First run: setup failed with `usermod: group 'render' does not exist`. Make setup create missing `video` and `render` groups before adding the user; verify the rehearsal passes all 23 checks (`23 passed, 0 failed`, about a minute with the image cached)

## 4. Telling future changes when to rehearse

- [x] 4.1 Update the `window-display` schema:
  - name the box's OS and versions in the design constraints;
  - add a rehearsal paragraph to specs, saying it doesn't replace scenario tests;
  - add a design paragraph naming the rehearsal checks that cover a change;
  - add a verification step to run the rehearsal when design says the change touches what it runs;
  - update the apply step to match.

  Verify `openspec schema validate window-display`.
- [x] 4.2 Update `openspec/config.yaml` and the window-display-schedule skill: the box's OS and versions, a "Rehearsing on the box's OS" section (what it runs, fakes, checks, needs, how long it takes, what it can't check, how to update for a new Debian release), the test step pointing to it, and the dry-run fakes including `groupadd`

## 5. Verification

- [x] 5.1 Run every Node test file and verify they pass (13 player, 26 scheduler, 5 spec, 13 website)
- [x] 5.2 Disable check for the rehearsal: set `rotate: 0` in `config.js` and rerun. Verify exactly the rotation check fails (`22 passed, 1 failed`, last frame 108 × 192), then restore it. The group fix was already proven by the first run failing without it.
- [x] 5.3 Run the rehearsal on the final code and verify `23 passed, 0 failed`
- [x] 5.4 Run `openspec validate add-box-rehearsal --strict` and verify it is valid

## Workflow follow-up

- Archive this change together with replace-mac-with-pi-box once the Pi passes its on-box checks.
- Nothing to install on the box beyond rerunning setup as usual.
