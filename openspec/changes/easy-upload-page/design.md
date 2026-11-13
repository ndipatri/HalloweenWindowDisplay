## Context

The website (`scheduler/website.js`) serves one page, `PAGE`, at `/`. Uploads are one raw `POST /api/uploads?name=<file>` per file with the PIN in `X-Upload-Pin`, after `POST /api/uploads/check { files }` has checked the PIN and the whole batch. Box tags live in `~/video-scheduler/tags.json` (`POST /api/tags`, no PIN). `POST /api/show { tags, until: 'cleared' }` plays tags until changed (no PIN). The QR code on the TV is `http://<address>/`.

## Decisions

**Two pages, two routes.** `GET /` serves a new `EASY_PAGE`; `GET /advanced` serves `PAGE`, unchanged apart from a link at the top ("Easy page"). The easy page links to "Advanced". The QR code keeps pointing at `/`, so it opens the easy page with no change to the player.

**The name becomes a tag on the box, not in the page.** `visitorTag(name)` in `website.js`: trim; empty → `Type your name first.`; strip accents (NFKD, drop combining marks), lowercase, every run of other characters → `-`, trim dashes, cut to 30 and trim dashes again (so it passes `logic.isTagName`); nothing left → `Use some letters or numbers in your name.`; a tag in the reserved set → `That name is taken by the box. Try adding your last name.` The reserved set is `upload`, `portrait`, `landscape`, `square`, and every folder tag of a GitHub item (`logic.items()` folder tags of items outside `photos/`). Box tags other visitors (or the owner) made are not reserved: the same name adds to the same tag, as the user chose.

**The name is checked with the batch.** `POST /api/uploads/check { files, name }`: the name is checked first (it costs no PIN try), then the PIN and files as today; the answer adds `tag`. Without `name`, check behaves exactly as today.

**The tag rides on each upload.** `POST /api/uploads?name=<file>&tag=<tag>`: `receiveUpload` gets `tag`; when given it must be a valid, unreserved tag (`visitorTag` rules on the tag itself), refused before the body is read otherwise. After the file is numbered into place its path gets the tag in `tags.json` (added to any it has) and the box is told filters changed, as `POST /api/tags` does. The log line becomes `Uploaded photos/00007-beach.jpg (2.0 MB) for aunt-sue`. Without `tag`, nothing changes.

**Playing is the existing `POST /api/show`.** After the last file, the page sends `{ tags: [tag], until: 'cleared' }`. Only the visitor's tag plays (every upload under that name, earlier visits included), until someone changes it on either page.

**The page's flow is testable on its own.** Like `sendBatch`, the easy page's `sendVisit(form, api, ui)` sits in its own `<script>` with no page code, so the tests run it in `vm` with a fake box: missing name, PIN or files are caught before anything is sent (`Type your name first.`, `Type the PIN first.`, `Choose some photos or videos first.`); then check, each upload, then show; it stops at the first refusal, plays nothing, and forgets the PIN on a wrong PIN. At the end it says `Done! Your pictures are on the TV now.` The PIN is remembered in the same `localStorage` key as the advanced page.

## Testability

Every scenario goes through the request handler (`site().call` / `uploads()` in `website.test.js`, real files in a temp folder for uploads) or the page's `sendVisit` run in `vm`. The address code scenario uses `address_code.addressUrl` and `GET /`.

## Rehearsal

The change touches `website.js`, which the rehearsal runs. Its "the website page loads" check moves to `/advanced`; a new check reads `/` for the easy page, and a visitor upload with `tag=` followed by `POST /api/show` must log the tag playing (`#<tag>: playing …`).

## Box-only

Scanning the QR code on the real TV with a phone opens the easy page, and a phone camera roll pick sends and plays. That's a check in tasks.
