## Why

The project started as a Halloween window, but it is now a general box for any TV: seasonal videos on a schedule, your own photos, visitors adding theirs from a QR code, portrait or landscape. Its name and wording should say so: **tvBox**, everywhere.

## What Changes

- **The repo becomes `ndipatri/tvBox`.** New cards clone `https://github.com/ndipatri/tvBox.git` by default into `~/tvBox`; the docs and skills use that path and name. (The GitHub repo itself is renamed separately; GitHub keeps redirecting the old name.)
- **The website is called tvBox:** both pages' titles, and the advanced page's heading; the easy page says the pictures play "on the TV".
- **The skills and the OpenSpec schema are renamed** `tvbox-schedule`, `tvbox-video`, `tvbox-emulator` and `tvbox`; archived changes name the `tvbox` schema.
- **The README is rewritten as tvBox**, covering the whole feature set; the Halloween window stays as the first example.
- **Unchanged:** the `halloween` content (its folder, tags and the Halloween filters) is one season among others; the box's own name `tvbox` and `tvbox.local` were already right.
- **An existing box** keeps working from `~/HalloweenWindowDisplay`; moving it is one command in the README (`mv` then setup), since setup wires sync to wherever it is run from.

## Capabilities

### Modified Capabilities

- `card-maker`: the first boot clones into `~/tvBox`, from `ndipatri/tvBox` by default.
- `override-website`, `visitor-page`: the pages are titled tvBox.

## Impact

- **Code:** `cards/make-cards.js` (default repo), `cards/firstboot.sh` (clone path), `cards/cloud-init.js` (unit description), `scheduler/website.js` (titles), comments in `setup.sh` and `config.js`.
- **Tooling and docs:** the three skills (renamed), `openspec/schemas/tvbox`, `openspec/config.yaml`, archived changes' `.openspec.yaml`, the rehearsal and emulator's repo path, README, `playlists/README.md`.
