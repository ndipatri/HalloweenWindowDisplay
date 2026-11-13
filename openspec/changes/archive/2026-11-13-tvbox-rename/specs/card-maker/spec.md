## MODIFIED Requirements

### Requirement: The box sets itself up on first boot
A card SHALL install a first-boot service that waits for the network, installs git if missing, clones the repo (by default `https://github.com/ndipatri/tvBox.git`) into the user's `~/tvBox`, and runs its `scheduler/setup.sh` for the user, retrying after a failure, even across reboots, until it succeeds once.

#### Scenario: the card sets the box up on first boot
- **GIVEN** answers with user `nick` and repo `https://github.com/ndipatri/tvBox.git`
- **WHEN** the card's files are made
- **THEN** `user-data` writes `/etc/tvbox/firstboot.conf` (naming the user, repo and time zone), `/usr/local/sbin/tvbox-firstboot` (the first-boot script) and `/etc/systemd/system/tvbox-firstboot.service`
- **AND** the service restarts on failure and only runs until `/var/lib/tvbox/firstboot-done` exists
- **AND** `runcmd` enables the service and starts it without waiting
- **AND** the first-boot script clones into `~/tvBox`, and the card maker offers `https://github.com/ndipatri/tvBox.git` as the repo
