# card-maker Specification

## Purpose
Turns out SD cards that each become a working tvbox when first plugged in, from one set of answers, without writing to the wrong disk or putting the user's password on the card in readable form.

## Requirements

### Requirement: The card names the box, its user and time zone
A card's `user-data` SHALL be a cloud-init config that sets the box's name, creates the user in Raspberry Pi OS's usual groups with password login and SSH on, and sets the time zone. `meta-data` SHALL be local, with an id unique to the card, so first-boot setup runs on every new card.

#### Scenario: the card's user-data names the box, the user and the time zone
- **GIVEN** answers with box name `tvbox2`, user `nick` and time zone `America/New_York`
- **WHEN** the card's files are made
- **THEN** `user-data` starts with `#cloud-config` and sets `hostname: tvbox2` and `timezone: America/New_York`
- **AND** it creates user `nick` with groups including `sudo`, `video` and `render`, password login allowed, and SSH on

#### Scenario: each card gets its own instance id
- **GIVEN** two cards made from the same answers, for `tvbox` and `tvbox2`
- **WHEN** their files are made
- **THEN** each `meta-data` has `dsmode: local` and an `instance_id` that starts with the box's name
- **AND** the two ids differ

#### Scenario: an SSH key is added when one is given
- **GIVEN** answers with an SSH public key `ssh-ed25519 AAAA… nick@mac`
- **WHEN** the card's files are made
- **THEN** user `nick` has that key in `ssh_authorized_keys`

### Requirement: The password is stored only as a hash
The user's password SHALL appear on the card only as a SHA-512 crypt hash (`$6$…`) that Linux accepts, never as typed.

#### Scenario: the user's password is on the card only as a SHA-512 hash
- **GIVEN** answers with the password `Spooky Window 2026!`
- **WHEN** the card's files are made
- **THEN** no card file contains `Spooky Window 2026!`
- **AND** user `nick`'s `passwd` is a `$6$` hash that checks out against `Spooky Window 2026!`

#### Scenario: the password hash is one Linux accepts
- **GIVEN** the published SHA-512 crypt test vectors (`Hello world!` with salt `saltstring`, and with `rounds=10000` and salt `saltstringsaltstring`)
- **WHEN** they are hashed
- **THEN** the results are exactly the published hashes

### Requirement: The card joins the Wi‑Fi
A card's `network-config` SHALL be a netplan version 2 config through NetworkManager that joins the given Wi‑Fi with the given country's radio rules, and also uses wired Ethernet when plugged in. Names and passwords SHALL be written so that any characters survive.

#### Scenario: the card's network-config joins the Wi-Fi with the right country
- **GIVEN** answers with Wi‑Fi `Pumpkin Patch`, password `hunter22` and country `US`
- **WHEN** the card's files are made
- **THEN** `network-config` has, under `wifis`, `renderer: NetworkManager` and `wlan0` with `dhcp4: true`, `regulatory-domain: "US"`, and access point `Pumpkin Patch` with password `hunter22`
- **AND** `eth0` with `dhcp4: true`

#### Scenario: a Wi-Fi name or password with quotes and colons is written safely
- **GIVEN** Wi‑Fi `Nick's "Net": 5G` with password `a:b"c\d #e`
- **WHEN** the card's `network-config` is read back as YAML
- **THEN** the access point's name is `Nick's "Net": 5G` and its password is `a:b"c\d #e`, exactly

### Requirement: The box sets itself up on first boot
A card SHALL install a first-boot service that waits for the network, installs git if missing, clones the repo (by default `https://github.com/ndipatri/tvBox.git`) into the user's `~/tvBox`, and runs its `scheduler/setup.sh` for the user, retrying after a failure, even across reboots, until it succeeds once.

#### Scenario: the card sets the box up on first boot
- **GIVEN** answers with user `nick` and repo `https://github.com/ndipatri/tvBox.git`
- **WHEN** the card's files are made
- **THEN** `user-data` writes `/etc/tvbox/firstboot.conf` (naming the user, repo and time zone), `/usr/local/sbin/tvbox-firstboot` (the first-boot script) and `/etc/systemd/system/tvbox-firstboot.service`
- **AND** the service restarts on failure and only runs until `/var/lib/tvbox/firstboot-done` exists
- **AND** `runcmd` enables the service and starts it without waiting
- **AND** the first-boot script clones into `~/tvBox`, and the card maker offers `https://github.com/ndipatri/tvBox.git` as the repo

### Requirement: Box names
Box names SHALL default to `tvbox`, then `tvbox2`, `tvbox3`, and so on. A name SHALL be accepted only if it is a valid host name: 1–63 lowercase letters, digits and hyphens, not starting or ending with a hyphen.

#### Scenario: box names are numbered tvbox, tvbox2, tvbox3
- **GIVEN** no cards made yet in this run
- **WHEN** three default names are asked for, one after another
- **THEN** they are `tvbox`, `tvbox2` and `tvbox3`

#### Scenario: a box name that isn't a valid host name is refused
- **GIVEN** the names `TV Box`, `-tvbox`, `tvbox-`, `tv_box`, an empty name, and 64 letters
- **WHEN** each is checked
- **THEN** each is refused, while `tvbox`, `tvbox2` and `front-window` are accepted

### Requirement: Answers the box can use
The card maker SHALL accept only a user name Linux accepts (a lowercase letter or `_`, then up to 31 lowercase letters, digits, `_` or `-`) and a two-letter country code for the Wi‑Fi's radio rules, given in either case.

#### Scenario: answers that Linux or the Wi-Fi can't use are refused
- **GIVEN** the user names `Nick`, `1nick`, `nick smith` and an empty name, and the countries `USA`, `U` and `1A`
- **WHEN** each is checked
- **THEN** each is refused, while `nick`, `_svc`, `pi-user`, `US` and `gb` are accepted, and `gb` becomes `GB`

### Requirement: Only SD cards can be written, and only once confirmed
The card maker SHALL offer only whole, physical disks of 4–256 GB that are either external, or a removable card in the Mac's own SD card slot; never the Mac's own drive or the disk it started from, including the physical drive behind an APFS start-up container. It SHALL write only after the chosen disk's identifier is typed back exactly.

#### Scenario: only external, physical, SD-card-sized disks are offered
- **GIVEN** the Mac's disks:
  - its own 128 GB internal drive;
  - a 64 GB external SD card;
  - a 2 TB external drive;
  - a disk image;
  - a 1 GB USB stick
- **WHEN** the disks to offer are chosen
- **THEN** only the 64 GB SD card is offered

#### Scenario: a card in the Mac's own SD card slot is offered
- **GIVEN** a 32 GB card in the Mac's built-in SD card slot, which macOS reports as internal, removable and ejectable, on the Secure Digital bus
- **WHEN** the disks to offer are chosen
- **THEN** that card is offered

#### Scenario: the disk the Mac runs from is never offered
- **GIVEN** the Mac started from APFS container `disk5`, whose physical store is `disk2s2` on an external 128 GB disk `disk2`
- **WHEN** the start-up disks are worked out and the disks to offer are chosen
- **THEN** the start-up disks are `disk5` and `disk2`
- **AND** `disk2` is not offered

#### Scenario: writing needs the disk's name typed back
- **GIVEN** the chosen disk is `disk4`
- **WHEN** the confirmation typed is `disk4`, then ` disk4 `, then `disk5`, then `yes`
- **THEN** only `disk4` and ` disk4 ` confirm it

### Requirement: The download is checked
The card maker SHALL write an image only if its SHA-256 matches the checksum Raspberry Pi publishes for it.

#### Scenario: a download that doesn't match its checksum is refused
- **GIVEN** a downloaded image and its published checksum
- **WHEN** the image is checked against the right checksum, then against a different one
- **THEN** the first check passes and the second refuses the image
