## Context

See proposal.md - Why. The box will run the latest Raspberry Pi OS Lite (64-bit): Debian 13 (trixie) on arm64, with the Raspberry Pi archive on top. Its apt has Node.js 20.19 and mpv 0.40 from Debian, and ffmpeg `7.1.5-0+deb13u1+rpt2` from the Raspberry Pi archive. Until now, mpv had only been tried at 0.37 on Intel Ubuntu, and setup had only been dry-run with every system command faked.

## Goals / Non-Goals

**Goals:**
- One command that rehearses the box on its OS and says plainly what passed.
- Real packages, real setup, the real player, website and mpv. Fake only what a container can't have: systemd running, a TV, and the network clock.

**Non-Goals:**
- Replacing scenario tests: every scenario stays a Node test of the same name.
- Checking what needs the Pi: the TV picture, full-size playback speed, mpv drawing straight to the screen, booting, and Wi‑Fi.

## Decisions

- **Docker with `debian:trixie` on arm64, plus the Raspberry Pi archive.** Rejected: the Raspberry Pi OS image itself, which is a disk image for an SD card, not a container, and would need a full ARM machine emulator to boot. The packages that matter (mpv, nodejs, ffmpeg and its libraries) are the same.
- **The archive is signed with the key from `raspberrypi-archive-keyring`,** the package Raspberry Pi OS ships. Rejected: `raspberrypi.gpg.key` from the archive's website, which Debian 13's apt refuses because its signature is bound with SHA‑1.
- **arm64 under emulation by default** (`tonistiigi/binfmt` on Intel), so it's the box's CPU. `TVBOX_E2E_PLATFORM=linux/amd64` is a faster option that doesn't use the box's CPU. The image installs the packages ahead of time, so later runs take about a minute.
- **The fakes:**
  - `systemctl` records calls, and runs the sync for `start tvbox-sync.service`, as the unit would;
  - `timedatectl` records calls;
  - `mpv` wraps the real mpv and adds `--vo=image` after the box's options, so frames become PNGs. mpv uses the last value given for an option, so these win.

  None of this touches the shipped code. Rejected: a test switch in `mpv.js` or `config.js`, which would put test-only code on the box.
- **The test repo** is the repo with three 2-second portrait clips (orange, purple, green) and a broken file in place of the videos. It's its own git repo with no remote, so sync's pull fails fast, as when offline.
- **Changes made only for the test:** the installed config's `webPort` is set to 8080 and `clockFile` to a file the test creates. The container has no `CAP_NET_BIND_SERVICE` for port 80, and no timesyncd.
- **The checks** follow what the person would see:
  - setup succeeds, copies the code, enables the units, and systemd's own check accepts them;
  - the first sync copies the clips;
  - the player starts, and the website answers;
  - an override from the website shows in the status;
  - mpv plays the clips in order and skips the broken one, logging it once;
  - frames are drawn, turned to 192 × 108 from a 108 × 192 clip, in a clip's colour;
  - black stops frames; back to schedule removes the override;
  - killing mpv makes the player exit with code 1, logging why.
- **Setup creates missing `video` and `render` groups** (`groupadd --system`) before adding the user. Raspberry Pi OS normally has both, but `tvbox.service` names them in `SupplementaryGroups`, and systemd refuses to start a service whose groups don't exist.

## Risks / Trade-offs

- [Emulated arm64 is slow, and the first image build takes 10+ minutes] → The packages are installed in the image, so reruns are about a minute. amd64 is available for quick runs.
- [Docker isn't running in every session] → The skill says how to start it in a cloud session, and `box.e2e.sh` says so when it isn't running.
- [The archive's keyring package version changes] → The Dockerfile names it. The skill says to update it, and the `FROM` line, when Raspberry Pi OS moves to a new Debian release.
- [Passing here doesn't prove the TV picture] → Those checks stay on the box (replace-mac-with-pi-box, Workflow follow-up).

## Getting it onto the box

Nothing new to install. If setup has already been run on the box, rerunning it changes nothing unless `render` was missing. The rehearsal checks behave the same with this change's `setup.sh`.

Rehearsal coverage: this change touches `setup.sh`, which the rehearsal runs. The checks "setup finishes without an error" and "systemd accepts the units" cover the group fix; the first run failed on exactly that.
