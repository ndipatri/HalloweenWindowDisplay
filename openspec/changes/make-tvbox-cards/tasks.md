# Tasks

## 1. What a card needs (checked on the real image)

- [x] 1.1 Download Raspberry Pi OS Lite (64-bit) 2026-10-06 (Debian 13) and verify its published SHA-256. Read its boot partition:
  - it has `user-data`, `network-config` and `meta-data`: `dsmode: local`, `instance_id`, and commented templates.

  Read its root filesystem:
  - cloud-init 25.2, with NoCloud from `/boot/firmware`; `write_files`, `users_groups`, `ssh`, `set_passwords`, `timezone`, `raspberry_pi` and `runcmd` enabled;
  - avahi-daemon, logrotate, curl, NetworkManager and netplan installed;
  - **no git**, nodejs or mpv;
  - all 15 of Imager's user groups exist.

## 2. Tests first

- [x] 2.1 Write `scheduler/tests/cards.test.js`: one test per card-maker scenario, named exactly as the scenario, reading the files back with PyYAML as cloud-init does; verify all fail on assertions against a stub `cards/cloud-init.js`, and `node openspec/check-scenarios.js make-tvbox-cards` finds every scenario's test
- [x] 2.2 While writing the code, add the scenario "answers that Linux or the Wi-Fi can't use are refused" (user name and country checks the CLI uses), with its test

## 3. The card maker

- [x] 3.1 `cards/cloud-init.js`:
  - the user-data, network-config and meta-data builders (values as JSON strings, which are valid YAML);
  - SHA-512 crypt;
  - the name, user and country checks;
  - `pickCards`, `bootWholeDisks`, `confirms` and `checksumMatches`.

  Verify the card tests pass. The password hash matches the two published vectors, and matches `openssl passwd -6` for 200 random passwords and salts, including non-ASCII.
- [x] 3.2 `cards/firstboot.sh`: wait for the repo's host, install git if missing, clone as the user (via `.partial`, so an interrupted clone is redone), run setup with `SUDO_USER`, then mark it done; verify `bash -n`
- [x] 3.3 `cards/make-cards.js`:
  - the questions (hidden passwords, asked twice);
  - the cached, checksum-checked download;
  - unpacking with `xz` or `python3`;
  - on the Mac: `diskutil`/`plutil` disk listing, the typed confirmation, `sudo dd` to the raw disk, mounting `bootfs`, writing the files, ejecting;
  - `--to-file` on Linux with mtools.

  Verify `node --check` and `--help`.
- [x] 3.4 Disable check found two real gaps in choosing disks, both fixed with scenarios and tests:
  - **A card in a MacBook's built-in SD slot is reported as internal,** so it would never have been offered. Listing now covers all physical disks, and an internal disk is allowed only when it's removable, ejectable `Secure Digital` media. New scenario: "a card in the Mac's own SD card slot is offered".
  - **On APFS, the start-up disk `diskutil` names is a synthesized container,** not the physical drive, so the start-up check couldn't match a physical disk. `bootWholeDisks` adds the container's physical stores' whole disks from `diskutil apfs list`. The scenario "the disk the Mac runs from is never offered" now gives that shape.

  The fakes now name a synthesized start-up container (`disk3`), so the internal-drive check stands on its own.

## 4. Docs

- [x] 4.1 README "The boxes": make the cards with `node cards/make-cards.js`, plug in, wait 10–20 minutes, then open the page; a troubleshooting row for a new box that never comes up. Schedule skill: "Making cards (new boxes)".

## 5. Verification

- [x] 5.1 Run every Node test file and verify they pass (16 cards, 13 player, 26 scheduler, 5 spec, 14 sync, 18 website)
- [x] 5.2 Run `node openspec/check-scenarios.js make-tvbox-cards` and verify every scenario has its test
- [x] 5.3 Disable check: break `cards/cloud-init.js` 21 ways in a copy (from a missing hostname or wrong hash byte order to internal disks offered, the built-in slot not offered, a physical store ignored, and any answer confirming) and verify every one fails its test
- [x] 5.4 Add the scenario-to-test table below
- [x] 5.5 Real image: `--to-file` with the 2026-10-06 Lite image, then read the three files back from the card image with `mtype` and parse them. Verify:
  - the name, user, `$6$` hash, time zone, first-boot files, `runcmd`, Wi‑Fi, country and instance id are right;
  - the password as typed appears nowhere;
  - the OS partition is byte-for-byte Raspberry Pi's.
- [x] 5.6 Rehearsal on the box's OS, now with cloud-init and netplan from the Raspberry Pi archive. New checks:
  - `cloud-init schema` accepts the card's `user-data` and `network-config`;
  - the card's `write_files` install the first-boot script, its settings and its service;
  - systemd accepts the service;
  - the first-boot script installs, clones and sets up the box. Every later check then runs on what first boot set up.

  The first run failed on `network-config`, because without netplan, cloud-init's fallback schema rejects `wifis`. With netplan, as on the box, it's valid, and a deliberately wrong file is still rejected. Final run: `36 passed, 0 failed`.
- [x] 5.7 Run `openspec validate make-tvbox-cards --strict` and verify it is valid

Every scenario is enforced by the test of the same name in `scheduler/tests/cards.test.js`. Each row gives a break to `cards/cloud-init.js` that makes that test fail:

| Scenario (= test name) | Fails when |
|---|---|
| the card's user-data names the box, the user and the time zone | hostname not set; user not in the render group |
| each card gets its own instance id | same instance id on every card |
| an SSH key is added when one is given | SSH key dropped |
| the user's password is on the card only as a SHA-512 hash | password written as typed |
| the password hash is one Linux accepts | wrong byte order in the hash; rounds ignored |
| the card's network-config joins the Wi-Fi with the right country | country not set |
| a Wi-Fi name or password with quotes and colons is written safely | Wi‑Fi name unquoted |
| the card sets the box up on first boot | first boot not retried; first boot not started |
| box names are numbered tvbox, tvbox2, tvbox3 | names not numbered |
| a box name that isn't a valid host name is refused | underscores allowed in names |
| answers that Linux or the Wi-Fi can't use are refused | capital user names allowed |
| only external, physical, SD-card-sized disks are offered | internal disks offered; big disks offered |
| a card in the Mac's own SD card slot is offered | built-in slot not offered |
| the disk the Mac runs from is never offered | start-up disk offered; physical store ignored |
| writing needs the disk's name typed back | any answer confirms |
| a download that doesn't match its checksum is refused | checksum not compared |

## Workflow follow-up

- **On the person's Mac** (box-only checks; they can't be run here):
  - `node cards/make-cards.js` lists the card, and only the card;
  - it writes the card;
  - macOS's "initialise" prompt is ignored;
  - the card ejects.
- **On the first real Pi:**
  - it joins the Wi‑Fi;
  - `/var/log/tvbox-firstboot.log` ends with "Done";
  - `http://tvbox.local/` answers.
- Archive this change after review.
