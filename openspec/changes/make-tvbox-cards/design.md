## Context

See proposal.md - Why. Raspberry Pi OS on Debian 13 configures itself on first boot with cloud-init, from three files on the card's FAT boot partition (`bootfs`): `user-data`, `network-config` and `meta-data`. Raspberry Pi Imager 2.0 writes these. In the 2026-10-06 Lite image, which I checked:

- **The files' defaults:** `meta-data` is `dsmode: local` plus `instance_id: rpios-image`, and `network-config` and `user-data` are commented templates.
- **cloud-init 25.2:**
  - `datasource_list: [NoCloud, None]`, seeded from `/boot/firmware`;
  - the modules `write_files`, `users_groups`, `ssh`, `set_passwords`, `timezone`, `raspberry_pi` and `runcmd` are enabled.
- **Installed:** avahi-daemon (so `<name>.local` works), logrotate, curl, NetworkManager and netplan.
- **Not installed:** git, nodejs and mpv.
- **Groups:** all 15 groups Imager gives the user exist, from `users` to `sudo`.

## Goals / Non-Goals

**Goals:**
- One run makes any number of cards, each a different box, asking the shared questions once.
- A card needs nothing after flashing: plug it into a Pi and the TV, and power it on.
- The risky step, writing a disk, can only hit a disk that looks like an SD card, and only after its name is typed back.

**Non-Goals:**
- Windows support.
- Saving answers between runs.
- Updating boxes that already exist (setup does that).

## Decisions

- **Node, as a single CLI `cards/make-cards.js`,** using only built-in modules and the Mac's own tools: `diskutil`, `plutil`, `dd` and `sudo`, plus `xz`, or `python3`'s `lzma` to unpack. The pure parts are in `cards/cloud-init.js`, which the tests require:
  - the file builders;
  - SHA-512 crypt;
  - name checks;
  - the disk filter;
  - the confirmation check;
  - the checksum check.

  Rejected: bash. YAML quoting, password hashing and plist parsing are much easier to get right, and to test, in Node.
- **The user's password is hashed with SHA-512 crypt implemented in `cloud-init.js`,** following the published algorithm (5000 rounds by default, 16-character random salt). It's tested against the published vectors and against OpenSSL's `openssl passwd -6`. Rejected:
  - `openssl passwd -6` on the Mac, because macOS's LibreSSL doesn't reliably have it;
  - `plain_text_passwd`, which would leave the password on the card.
- **YAML values are written as JSON strings.** A JSON string is a valid YAML double-quoted scalar, so quotes, colons, `#` and backslashes survive. File contents use YAML block scalars (`|`), with every line indented.
- **The first boot is a systemd service, not just `runcmd`.** `runcmd` runs once per instance, so a first boot without Wi‑Fi would never set up. Instead:
  - `write_files` installs `tvbox-firstboot` (from `cards/firstboot.sh`), its config `/etc/tvbox/firstboot.conf`, and `tvbox-firstboot.service` (`Type=oneshot`, `Restart=on-failure`, `RestartSec=60`, `StartLimitIntervalSec=0`, `ConditionPathExists=!/var/lib/tvbox/firstboot-done`, `TimeoutStartSec=0`);
  - `runcmd` only enables it and starts it with `--no-block`, which avoids an ordering loop with cloud-init's last stage.

  The script:
  - waits up to 10 minutes for the repo's host, when it's a web address;
  - installs git;
  - clones the repo as the user, if it isn't cloned yet;
  - runs `SUDO_USER=<user> bash scheduler/setup.sh` as root;
  - marks itself done.

  Its output goes to `/var/log/tvbox-firstboot.log`.
- **`meta-data`** is `dsmode: local` plus `instance_id: <name>-<time>-<random>`, so a reused card or a second box starts fresh.
- **`network-config`:** netplan v2, `wifis.renderer: NetworkManager`, `wlan0` (`dhcp4`, `optional: true`, `regulatory-domain`, `access-points`), and `ethernets.eth0` (`dhcp4`, `optional: true`). `optional: true` keeps boot from waiting for the network. The first-boot service does its own waiting.
- **Choosing a disk on the Mac:**
  - `diskutil list -plist physical` gives the candidates (all physical disks, because a card in a MacBook's built-in SD slot is reported as internal);
  - `diskutil info -plist` gives each one's details;
  - `plutil -convert json` turns both into JSON;
  - `diskutil info -plist /` finds the start-up disk, which on APFS is a synthesized container (like `disk3`). `diskutil apfs list -plist` gives that container's physical stores (like `disk0s2`), and their whole disks count as start-up disks too (`bootWholeDisks`).

  The filter (`pickCards`) keeps whole, physical disks of 4–256 GB that aren't the start-up disk, and are either not internal, or internal but removable and ejectable media on the `Secure Digital` bus (the built-in slot). The Mac's own drive is internal and not removable, so it's never offered, whatever its size. The person then types the identifier, and it must match exactly (spaces trimmed).
- **Writing on the Mac:**
  - `sudo -v` asks for the password first;
  - `diskutil unmountDisk`;
  - the unpacker's output is piped to `sudo dd of=/dev/rdiskN bs=4m`, with progress counted on the compressed bytes read;
  - `sync`, then `diskutil mountDisk`;
  - the files are written to `bootfs`'s mount point;
  - `diskutil eject`.

  macOS may offer to initialise the card's Linux partition at that point; the script says to choose Ignore.
- **The download:** the URL `https://downloads.raspberrypi.com/raspios_lite_arm64_latest` redirects to the dated image, whose `.sha256` sits beside it. Both are kept in `~/Library/Caches/tvbox` (or `~/.cache/tvbox`), checked by SHA-256 before each run, and downloaded again only if missing or wrong. Offline, a cached image is used with its saved checksum.
- **`--to-file <image> --answers <json>` (Linux):** copies the unpacked image to a file and writes the files into its first partition with `mcopy` at the partition's offset. It's used for testing here, with the same builders as the card path.

Each scenario's test reaches the behaviour like this:
- the builders, the filter and the checks are called from `cards.test.js`;
- the disk filter is given JSON in the shape `diskutil` and `plutil` produce;
- the checksum check is given a temporary file.

## Risks / Trade-offs

- [The Mac flashing path can't be run here (no Mac with a card reader)] → Everything it decides is tested: which disks, the confirmation, the files, the checksum. The write itself is `dd`, as Raspberry Pi's own docs use. The first real card is a box-only check.
- [`diskutil` field names] → `pickCards` uses only long-standing keys (`DeviceIdentifier`, `WholeDisk`, `Internal`, `VirtualOrPhysical`, `Size`/`TotalSize`, `RemovableMedia`/`Removable`, `Ejectable`, `BusProtocol`). If one is missing, the disk isn't offered, which fails safe: "No SD card found".
- [The first boot needs the internet: about 200 MB of packages, plus the repo] → It retries every minute until it succeeds, and logs to `/var/log/tvbox-firstboot.log`.
- [The Wi‑Fi password sits on the card] → Same as Raspberry Pi Imager. cloud-init copies it into NetworkManager on first boot.

## Getting it onto the box

Nothing to rerun on existing boxes. A new box is made by flashing a card with `node cards/make-cards.js` and plugging it in. Box-only checks:

- the first card boots, joins the Wi‑Fi, and is reachable at `<name>.local`;
- `/var/log/tvbox-firstboot.log` ends with setup's "Done";
- the website answers.

Rehearsal coverage:
- **Its OS gains `cloud-init` and `netplan.io`,** both from the Raspberry Pi archive as on the box, so `cloud-init schema` can check the generated `user-data` and `network-config`. With netplan installed, cloud-init checks version-2 network config with netplan's own parser. Without it, cloud-init falls back to a narrower schema that rejects `wifis`, even though Raspberry Pi's own example uses it. The first rehearsal run showed exactly this, before netplan was added.
- **New check "a card's first-boot script installs, clones and sets up the box":** it runs `cards/firstboot.sh` with a config naming the test repo, in place of the manual clone and setup.
- **The checks after it** (setup, the player, the website, …) then run on what first boot set up.
- **A one-off check against the real 2026-10-06 Lite image:** `--to-file`, then the files read back with `mtype`.
