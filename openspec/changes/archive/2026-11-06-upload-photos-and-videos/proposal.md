# Proposal

## Why

Everything the window plays has to be added to the repo today, which only works from a computer. The person wants to put their own photos and videos on the window straight from their phone, including ones from Google Photos, with no Google account set up on the box. The phone's own file picker already offers the Photos library (and Google Photos on Android), so uploading through the box's website covers it. The Google Photos Picker API was researched and set aside: it needs a Google Cloud project and OAuth tokens, and picks expire.

## What Changes

- **Add photos or videos** on the website (`http://tvbox.local/`): the phone's picker, several files at once, with a progress line for each. Each upload needs the box's **upload PIN**, which the phone remembers after the first time.
- Before sending anything, the page asks the box to check the whole batch: the PIN, each file's type and size, and room for all of it. A refusal shows at once, without sending any file. A wrong PIN stops the batch after one try, forgets the remembered PIN and asks again, so one slip can't use up all the tries.
- Uploads are stored on the box only, in `~/video-scheduler/photos/`, numbered in the order they arrived (`00001-img_1234.jpg`). They are not in the repo, so sync never touches them, and they are not backed up.
- The page lists the uploads with a small preview of each and a **Remove** button, which also needs the PIN. Remove takes the upload off the screen (moving on to the next one if it's showing) and out of the queue, then deletes the file.
- **Photos** becomes its own choice on the website, next to the season previews, with the usual durations (until the schedule changes, 15/30/60 minutes, until switched back). The schedule never plays uploads: a schedule entry for `photos` is ignored and logged.
- While Photos is on, the uploads play in the order they were added, round and round. Each photo stays on screen for **10 seconds** (`photoSeconds` in config.js), and videos play through. Photos are shrunk to fit the portrait screen with black around them, never cropped.
- mpv decodes **HEVC** in hardware with `--hwdec=drm`, limited to HEVC with `--hwdec-codecs=hevc`. HEVC is what an iPhone records, although Safari may convert videos to H.264 when uploading. H.264 stays in software, so the probing noise that `--hwdec=no` removed doesn't come back.
- **Limits:**
  - only JPEG and PNG photos and MP4, MOV and M4V videos;
  - at most 1 GB a file;
  - an upload is refused if it would leave the SD card with less than 2 GB free;
  - after five wrong PINs in a row, uploads, checks and removals are refused for five minutes.
- **The PIN** is 4 to 8 digits, kept only on the box in `~/video-scheduler/upload-pin`.
  - Setup asks for one when run from a terminal and no PIN is saved yet; `TVBOX_UPLOAD_PIN` sets or changes it; rerunning setup keeps it.
  - With no PIN (a box set up unattended from a card), adding photos is off, and the page says how to turn it on.
- The name `photos` is kept for uploads. A season or schedule entry named `photos` is ignored and logged, and sync leaves the box's `photos/` alone even if the repo ever has a `playlists/photos/`.
- The log notes every upload and removal, and the status line reads `photos (override …)` like any other choice.

## Capabilities

### New Capabilities
- `photo-uploads`: getting photos and videos onto the box from a phone through the website and removing them again, the upload PIN that guards both, the batch check, and the limits.
- `photos-playback`: what plays while Photos is on: the uploads in upload order, round and round, black with a plain log line when there are none, and a removed upload leaving the screen cleanly.

### Modified Capabilities
- `override-website`: the choices and the page offer Photos apart from the season previews.
- `box-player`: photos stay on screen for the configured time on black; HEVC is decoded in hardware.
- `seasons`: a season named `photos` is ignored and logged.
- `daily-schedule`: a schedule entry for `photos` is ignored and logged.
- `video-sync`: sync leaves the box's `photos/` folder alone.

## Impact

- `scheduler/website.js`: the check, upload, list, file and remove endpoints, and the page's new section. Uploads are streamed to disk, not read into memory.
- `scheduler/logic.js`: the `photos` name, photo files in the Photos playlist, and its empty-folder message.
- `scheduler/player.js`: taking a removed upload out of mpv's playlist.
- `scheduler/mpv.js`: the photo time, black background, `--hwdec=drm` and `--hwdec-codecs=hevc`.
- `scheduler/config.js`: `photoSeconds` and the upload limits.
- `scheduler/setup.sh`: the PIN and the `photos/` folder.
- `scheduler/sync_videos.sh`: skip `photos`.
- Tests: `website.test.js`, `scheduler.test.js`, `player.test.js`, `sync.test.js`, a new `setup.test.js`, and new checks in the rehearsal's `inside.sh`.
- README ("Using it": adding photos, the PIN) and the window-display-schedule skill.
- On the box: rerun setup. It asks for the PIN.

## Product decisions

From `photos-handoff.md` and our conversation:
- Uploads play only when Photos is chosen on the website, as their own "season": the handoff's option a, not mixed into seasons and not on a schedule.
- Uploads need a PIN.
- From the design review:
  - uploads are numbered (`00001-…`), not named by time, so same-second uploads keep their order;
  - a schedule entry for `photos` is ignored and logged;
  - the page checks the whole batch first and stops at a wrong PIN;
  - Remove takes an upload off the screen and out of the queue before deleting it.

## Assumed product decisions

My picks; change any of them.

- **Photo time:** each photo shows for **10 seconds**, not 5 or 20.
- **Where the PIN is set:** setup asks for it and keeps it on the box only. Not in config.js, which is in the public repo, and not through the card maker.
  - A box set up from a card has adding photos off until setup is rerun over SSH, which every scheduler change needs anyway.
  - Having the card maker ask is a possible follow-up.
- **PIN rules:** 4–8 digits. Five wrong or missing in a row lock uploads for five minutes.
- **Remove deletes the file for good.** Moving it to `.removed/` like sync does was rejected: the space would never come back.
- **Size limits:** at most **1 GB** a file, and at least 2 GB must stay free on the card.
- **File types:** JPEG and PNG photos only. HEIC is refused with a plain message, since an iPhone normally converts HEIC to JPEG when a web page's picker sends it. That is still to be checked on the box (see design.md).
- **Previews** come from the phone's browser: the photo itself, or the video's first frame. The box makes no thumbnails.
- **No cropping:** photos are fitted with black bars (from the handoff).
