## Why

Someone who walks up to the window and scans the QR code lands on the box's full website: Play, tags, filters, uploads, the log. They only want to put a few of their own pictures on the TV. There should be one simple page for that, and it should be the one the QR code opens.

## What Changes

- **A new "easy" page at the box's address (`/`)**, made for a phone: the visitor's name, the upload PIN, a picker for photos and videos, and a **Put them on the TV** button. The QR code (`http://<address>/`) opens it, unchanged.
- **The visitor's name becomes a tag** (`Aunt Sue` → `aunt-sue`), put on everything they add. A returning visitor with the same name adds to the same tag. A name that turns into a tag the box already uses for something else (a GitHub folder's tag such as `halloween`, or `upload`, `portrait`, `landscape`) is refused: "That name is taken by the box. Try adding your last name."
- **Put them on the TV** sends the files (with the PIN, as uploads always need), then plays that tag, and only that tag, until someone changes it, and says so.
- **The full page moves to `/advanced`.** Each page links to the other.
- **Uploads can carry a visitor tag:** `POST /api/uploads/check` takes the name and answers with its tag; `POST /api/uploads?name=…&tag=…` tags the saved file.

## Capabilities

### New Capabilities

- `visitor-page`: the easy page, the name-to-tag rule, tagged visitor uploads, and playing the visitor's tag.

### Modified Capabilities

- `override-website`: the full page is at `/advanced` and links to the easy page.

## Impact

- **Code:** `scheduler/website.js` (the easy page, routes `/` and `/advanced`, the name on `/api/uploads/check`, the tag on `/api/uploads`).
- **Rehearsal:** `inside.sh` reads the advanced page at `/advanced` and checks a visitor upload plays its tag.
- **Tests and docs:** `website.test.js`, the README, the schedule and emulator skills.
