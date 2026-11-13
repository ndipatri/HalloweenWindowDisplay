## Context

The box plays only items whose shape (`logic.shapeOf`: from the file's size, EXIF-turned; `square` only when width equals height) is the TV's (`screen.json`, `GET /api/screen`) or square. The easy page (`EASY_PAGE` in `website.js`) has a name field, a file picker and **Put them on the TV**; its flow is `sendVisit` in its own `<script>`, tested in `vm`.

## Decisions

**Measured on the phone, before sending.** When files are picked, each gets a thumbnail: photos as an `<img>` from `URL.createObjectURL`, videos as a `<video preload="metadata" muted playsinline>`; once loaded, `naturalWidth/Height` (photos; browsers apply EXIF orientation to these) or `videoWidth/Height` (videos) give the shape with the box's rule. The label shows under each thumbnail. A file that can't be measured gets no label and counts as fitting (no false warning).

**One rule, testable on its own.** `shapeOf(width, height)` and `fitNote(shapes, orientation)` sit in the same page-code-free `<script>` as `sendVisit`, so the tests run them in `vm`. `fitNote` answers the warning text when there is at least one measured shape and every one is the other non-square shape; otherwise `''`.

**The TV's way is read when the page opens and when files are picked** (`GET /api/screen`), so a turn while the visitor is choosing is caught.

**Warn, don't block.** The warning sits above the button; sending still works (the box keeps them; they play when the TV is turned). `sendVisit` takes the warning (`form.note`) and, when set, ends with `Done! They're on the box, but the TV is <way>, so they won't show until it's turned.` instead of the usual `Done! Your pictures are on the TV now.`

## Testability

`shapeOf`, `fitNote` and `sendVisit` run in `vm` from the page's text; the page's markup (thumbnail list, warning element, `/api/screen` fetch) is checked in the served HTML.

## Rehearsal

Only the page's HTML and script change; the box's routes don't. The rehearsal (which drives the API, not the page) needs no new check.

## Box-only

On a real phone: thumbnails appear with the right labels (including an iPhone photo stored sideways with EXIF), and the warning shows for landscape photos on the portrait TV.
