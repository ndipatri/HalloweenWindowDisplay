## Why

Running the window from a Mac means keeping a whole computer logged in behind the TV. A Raspberry Pi box plugged into the TV's HDMI can do the same job on its own, and managing both is too much, so the box replaces the Mac. The last Mac version stays available at the git tag `mac-legacy`.

## What Changes

- **BREAKING:** The Mac scheduler (JXA, AVFoundation, launchd), its installer and the `show` and `start` commands are removed. A Mac can still run the version at the `mac-legacy` tag.
- The season, schedule, override and playlist logic moves from the JXA script to plain Node modules, with no change in behaviour: the existing specs and their 26 tests carry over.
- A player on the box drives mpv full screen, rotated for the portrait TV, and stays black until the box's clock is set.
- A website on the box replaces `show`: it shows what's on screen and why, and changes what plays for a while, or goes back to the schedule.
- The same `sync` script keeps the videos up to date from GitHub, now every hour.
- `scheduler/setup.sh` sets up a fresh Raspberry Pi in one run.
- The README, the playlists README, both skills and the setup diagram (`docs/images/physical-setup.svg`) describe the box instead of the Mac.
- The `window-display` OpenSpec schema and `openspec/config.yaml` describe the box: its constraints (Node from apt with no npm packages, mpv, `sudo` only for setup), box-only checks in place of Mac-only ones, and a `## Getting it onto the box` section in place of `## Getting it onto the Mac`. The overrides spec's Purpose names the website.

## Capabilities

### New Capabilities
- `box-player`: what the box puts on the TV, through mpv: today's playlist on schedule, black otherwise or until the clock is set, what it reports, and recovering when mpv stops.
- `override-website`: the website on the box that shows the status and overrides the schedule, as `show` did on the Mac.

### Modified Capabilities
- None. `seasons`, `daily-schedule`, `overrides` and `playlists` keep their requirements. Their tests move to the new modules under the same names, and the overrides spec's Purpose now names the website instead of `show`.

## Impact

- `scheduler/`: `video_scheduler.js`, `show.sh`, `start.sh`, `install.sh` and the launchd plist are removed. Added: `config.js`, `logic.js`, `mpv.js`, `player.js`, `website.js`, `setup.sh`, and systemd units. `sync_videos.sh` is unchanged.
- `scheduler/tests/`: the scheduler tests load the Node modules. New `player.test.js`, `website.test.js`, and `fake_mpv.js` (the tests' stand-in for mpv).
- On the box: the mpv, nodejs and git packages from apt, the code in `/opt/tvbox`, and three systemd units.
- `openspec/`: the schema, its design and tasks templates, `config.yaml`, and the overrides spec's Purpose.
- `docs/images/physical-setup.svg`, `README.md`, `playlists/README.md`, and both skills in `.claude/skills/`.
- The Mac keeps playing the version it last installed until it's unplugged.

## Assumed product decisions

The person asked to start on the code while the box is shipping, so these were chosen without asking. Each can be changed:

- **The website has no password.** It's only reachable on the home network, at `http://<the box's name>.local/`. Rejected: a PIN, which you'd type on every visit.
- **Website choices:** each playlist in the schedule (kid, grownup), black, any season folder or season/playlist folder (previews), and back to the schedule. Each lasts until the schedule changes, 15, 30 or 60 minutes, or until switched back. Rejected: free typing, as with `show`.
- **Black until the clock is set:** after a power cut with no Wi‑Fi the box doesn't know the time, so it shows black rather than guessing. Rejected: trusting the last saved time, which could play grownup videos in the morning.
- **Rotation:** mpv turns the picture 90° for a TV standing on its side. If it comes out upside down, one setting flips it to 270°.
- **Sync** runs at boot and every hour. Rejected: only at boot, as on the Mac.
- **Updating the box's own code** means rerunning `setup.sh`, as the Mac's installer did. Rejected: updating itself on every sync.
- **The time zone** is set to America/New_York by `setup.sh`.
- **Left for later changes:** a read-only system that survives being unplugged mid-write, turning the TV on and off over HDMI‑CEC, and a sync button on the website.
