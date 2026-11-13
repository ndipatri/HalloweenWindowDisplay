## Why

The TV plays only pictures of its own shape (or square). A visitor who adds landscape photos while the TV is portrait gets a black screen and no idea why: on the real box, a visitor's single landscape photo left the TV black.

## What Changes

- **The easy page shows each picked photo or video** as a thumbnail with its shape: **Portrait**, **Landscape** or **Square**, measured by the phone the same way the box does (wider than tall is landscape; exactly equal is square).
- **A warning when none of them fit the TV:** if every picked file is the other shape from the way the TV faces now, the page says so before they tap **Put them on the TV**: `The TV is portrait, so landscape pictures won't show until it's turned.` (or the other way round). They can still send them.
- **The "Done" message says the same** when what was sent can't show: `Done! They're on the box, but the TV is portrait, so they won't show until it's turned.`
- A mix, or any square or matching picture, shows no warning (the ones that fit play).

## Capabilities

### Modified Capabilities

- `visitor-page`: the easy page previews picked files with their shape and warns when none fit the TV. (The capability is still in the open `easy-upload-page` change, so this change adds its requirement there.)

## Impact

- **Code:** `scheduler/website.js` (the easy page only; it reads `GET /api/screen`).
- **Tests and docs:** `website.test.js`, the README and the schedule skill. The rehearsal is unchanged (it doesn't drive the page).
