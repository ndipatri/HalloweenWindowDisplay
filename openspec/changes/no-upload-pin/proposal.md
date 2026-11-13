## Why

The upload PIN is unnecessary: the box sits on the home Wi‑Fi, and asking visitors who scanned the QR code for a PIN gets in the way. Play, tags, the TV's way and the address code switch already need no PIN.

## What Changes

- **BREAKING** **No PIN anywhere.** Adding photos and videos, removing them, and saving filters need no PIN, for anyone on the home network. `X-Upload-Pin` is ignored.
- **The PIN field goes from both pages:** the easy page (name and files only), and the advanced page's Photos and videos and Filters sections. A PIN an older page remembered is forgotten.
- **No more lock** after wrong PINs, and no "Adding photos is off" state: uploads always work.
- **Setup asks for no PIN** (`TVBOX_UPLOAD_PIN` is gone) and removes an `upload-pin` file an older setup saved, saying so.
- The open `easy-upload-page` change is updated to match (its PIN scenario goes; its page needs a name and files only).

## Capabilities

### Modified Capabilities

- `photo-uploads`: uploads, batch checks and removals need no PIN; no lock; setup asks for none.
- `filters`: saving filters needs no PIN.
- `override-website`: the filter editor has no PIN field.
- `tags`: removing an upload (which drops its box tags) needs no PIN.

## Impact

- **Code:** `scheduler/website.js` (PIN checks, lock and both pages' PIN fields removed), `scheduler/config.js` (`uploads.pinTries`, `lockMinutes` removed), `scheduler/setup.sh`.
- **Emulator and rehearsal:** `emulate.sh` and the rehearsal set no PIN; `inside.sh`'s wrong-PIN check goes.
- **Tests and docs:** `website.test.js`, `setup.test.js`, `player.test.js`, `scheduler.test.js`, the README and both skills.
