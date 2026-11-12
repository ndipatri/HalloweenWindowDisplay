## Why

People at home often can't open the box's website: `http://tvbox.local/` needs mDNS, which some Android phones, some Windows PCs and some mesh or guest Wi‑Fi networks don't support. The box's number address (say `http://10.0.0.25/`) always works, but nobody knows it, and the router can change it.

## What Changes

- **A QR code of the website's address on the TV.** For the first 3 seconds of each new item (photo or video), a small QR code of `http://<the box's address>/` shows in the bottom-right corner of the TV as people see it, whichever way the TV faces. Scanning it with a phone's camera opens the website. The address is read fresh each time, so the code stays right when the router hands out a new one. With no network address, no code is shown.
- **An on/off switch on the website.** Under TV: "Show the box's address on the TV", on by default, saved on the box. No PIN, like the TV buttons.
- **Setup installs `qrencode`**, which makes the code.

## Capabilities

### Modified Capabilities

- `box-player`: shows the address code when each item starts; setup installs `qrencode`.
- `override-website`: the switch for the address code.

## Impact

- **Code:** new `scheduler/address_code.js` (the address, the code's pixels, where it goes); `scheduler/player.js` (shows and hides it through mpv); `scheduler/website.js` (the switch and `GET`/`POST /api/address-code`); `scheduler/config.js` (`addressCode` settings); `scheduler/setup.sh` (`qrencode`).
- **Emulator and rehearsal:** the emulator's mpv has no picture output, so the TV view (port 8081) draws the code from what the player says it is showing.
- **Tests and docs:** `player.test.js`, `website.test.js`, `setup.test.js`, the rehearsal, the README and the schedule skill.
