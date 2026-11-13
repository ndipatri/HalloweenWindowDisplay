## Context

`cards/firstboot.sh` clones the repo into `~/HalloweenWindowDisplay` and runs its `scheduler/setup.sh`; setup finds the repo from its own path and writes it into `~/video-scheduler/sync`, so after setup the folder name only matters to people typing commands. The website's pages are titled "Window". The skills and the OpenSpec schema are named `window-display-*` and `window-display`.

## Decisions

**New cards use `~/tvBox` and `ndipatri/tvBox`.** `DEFAULT_REPO` and the clone path change; nothing else on the box refers to the folder.

**An existing box is moved by hand, once.** `mv ~/HalloweenWindowDisplay ~/tvBox && cd ~/tvBox && sudo bash scheduler/setup.sh` re-points sync at the new folder. Setup doesn't move it itself: moving the folder setup is running from, from inside setup, is fragile, and there is one box. Until moved, the old folder keeps working, and GitHub redirects its `origin` after the rename; `git remote set-url origin https://github.com/ndipatri/tvBox.git` makes it explicit.

**Rename the tooling outright.** Skills, schema directory and name, `openspec/config.yaml`, and the `schema:` line of every archived change (so `openspec` finds the schema for them). Archived proposals' prose keeps its old wording, as history.

**Keep the content.** `playlists/halloween/`, its tags and the GitHub filters "Halloween kid"/"Halloween grownup" stay, as do the specs' and tests' Halloween example data: they are a season, not the product's name.

**README.** Opens on what tvBox is and does, then the feature tour (schedule and filters, tags and favorites, your photos, visitors via the QR code and easy page, portrait/landscape and the tilt switch, many boxes, the emulator), with the Halloween window as the first installation and its videos as the first season.

## Testability

`cards.test.js` ("the card sets the box up on first boot") checks the first-boot script clones into `$home/tvBox` and the default repo is `ndipatri/tvBox`; `website.test.js` ("the easy page is at the box's address", "the advanced page is at /advanced and links to the easy page") checks the titles.

## Rehearsal

The rehearsal and emulator copy the repo to `/home/pi/tvBox` instead of `/home/pi/HalloweenWindowDisplay`, so setup and sync run from the new path end to end.

## Box-only

The GitHub rename, and moving the real box's folder, are done after merging.
