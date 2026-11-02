## Why

Setting up a box today takes Raspberry Pi Imager (picking the OS and typing the name, Wi‑Fi, user and password into its settings), then `ssh` and two commands on the box. For a batch of boxes, that's a lot of typing per box, and easy to get slightly wrong on one of them. The person wants to answer the questions once and turn out ready cards, each of which sets itself up when it's first plugged in.

## What Changes

- **`node cards/make-cards.js`**, run on the Mac:
  - asks once for the Wi‑Fi, the user, the password, an SSH key and the time zone;
  - downloads the latest Raspberry Pi OS Lite (64-bit) and checks it against Raspberry Pi's published checksum, keeping it for the next run;
  - then, for each card in turn: asks the box's name (tvbox, tvbox2, …), shows only the SD-card-sized external disks, asks for the chosen disk's name to be typed back, writes the OS to it, and adds the first-boot files.
- **First-boot files** (cloud-init, which Raspberry Pi OS reads from the card's boot partition):
  - the name, user (password stored only as a hash), SSH and time zone;
  - the Wi‑Fi and its country;
  - a first-boot service. It waits for the network, installs git, clones this repo and runs `scheduler/setup.sh`, retrying until it succeeds, even across reboots.
- **`node cards/make-cards.js --to-file <image> --answers <json>`** writes a finished card image to a file instead of a card. This is for testing on Linux, where the boot partition is edited with mtools.
- The README's "The box" setup becomes: make the cards, plug them in.

## Capabilities

### New Capabilities
- `card-maker`: what goes on a tvbox card: the first-boot files for a given box name, user, Wi‑Fi and time zone; the box names; which disks may be written and how that is confirmed; checking the download.

### Modified Capabilities
- None.

## Impact

- New `cards/`: `make-cards.js` (the CLI), `cloud-init.js` (builds the files; pure functions), and `firstboot.sh` (the first-boot script).
- New `scheduler/tests/cards.test.js`. New rehearsal checks: cloud-init's own schema check of the files, and the first-boot script cloning and setting up on the box's OS.
- `README.md` (setting up boxes), and the schedule skill.
- Needs on the Mac: Node.js 18 or later, `xz` or `python3` to unpack the image, and `sudo` to write the card.

## Assumed product decisions

The person chose for the script to also write the OS to the cards. The rest was decided without asking, and each can be changed:

- **Answers are asked once per run,** and then each card only needs its name and its disk. Nothing secret is saved between runs. Rejected: saving the answers, which would leave the Wi‑Fi password in a file.
- **Box names default to tvbox, tvbox2, tvbox3, …** Each box's website is then at `http://<name>.local/`.
- **SSH by password and by key** (if one is found in `~/.ssh` and accepted). `sudo` asks for the password, as on Raspberry Pi OS by default.
- **The Wi‑Fi password is written to the card as typed.** The network file can't hold a hash; Raspberry Pi Imager does the same. The user's password is stored only as a SHA-512 hash.
- **Disks offered:** external, physical, 4–256 GB, never the Mac's own disk. The disk's name (e.g. `disk4`) must be typed back before anything is written.
