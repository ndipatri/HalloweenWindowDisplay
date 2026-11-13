## Context

`website.js` checks `~/video-scheduler/upload-pin` (4 to 8 digits, saved by setup) against `X-Upload-Pin` on `POST /api/uploads`, `/api/uploads/check`, `/api/uploads/remove` and `/api/filters`, counts wrong PINs into a 5-minute lock (`config.uploads.pinTries`, `lockMinutes`), and reports `pinSet` on `GET /api/uploads` so the page can say adding is off. Both pages keep the PIN in `localStorage` (`tvbox-upload-pin`). Setup asks for it on a terminal, takes `TVBOX_UPLOAD_PIN`, and saves it `600`.

## Decisions

**Remove the PIN rather than make it optional.** `savedPin`, `samePin`, `checkPin`, the lock, `pinFrom` and `pinSet` go; the four routes take no headers. A request that still sends `X-Upload-Pin` is simply served. The user chose no PIN anywhere, including removing uploads and saving filters (like Play and tags).

**Pages.** The advanced page loses the PIN field (and the "Adding photos is off" note) in Photos and videos and the PIN field under Filters; `sendBatch(files, api, ui)` no longer takes a PIN or forgets one. The easy page loses its PIN field and `sendVisit` needs only a name and files. Both pages remove a remembered `tvbox-upload-pin` from `localStorage`, so it doesn't linger.

**Setup.** No prompt, no `TVBOX_UPLOAD_PIN`. If `~/video-scheduler/upload-pin` exists it is deleted, printing `The upload PIN is no longer used, so it was removed.`; the photos folder is made as before.

**Spec shape.** "Uploads need the PIN", "Too many wrong PINs lock uploads", "Setup sets the upload PIN" and filters' "The website saves the filters with the PIN" are removed and replaced by PIN-free requirements; the requirements whose scenarios only mentioned the PIN in passing are modified to drop it. The unarchived `easy-upload-page` change is edited in place.

## Testability

Website scenarios through `website.test.js`'s `uploads()` (real files) and `site()`; the pages' flows (`sendBatch`, `sendVisit`) in `vm`; setup through `setup.test.js` with fake commands and a fake terminal-less run; the old-PIN-file removal by placing the file first.

## Rehearsal

The change touches `website.js` and `setup.sh`. The rehearsal stops passing `TVBOX_UPLOAD_PIN` and drops "a batch check with the wrong PIN is refused (403)"; its uploads send no PIN header; a new check confirms setup removed an old `upload-pin`.

## Box-only

None beyond seeing both pages without a PIN field on a phone.
