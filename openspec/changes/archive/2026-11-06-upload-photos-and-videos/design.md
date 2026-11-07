# Design

## Context

See proposal.md (Why) and `photos-handoff.md` for the Google Photos research that led to uploading through the website instead.

What this builds on:
- **The video folder:** the box plays from `~/video-scheduler/<season>/`.
- **Sync:** `sync_videos.sh` has two loops:
  - the first mirrors each folder the repo has under `playlists/` (`sync_videos.sh:70-99`);
  - the second sets aside box subfolders the repo no longer has, inside top-level folders the repo does have (`sync_videos.sh:105-116`).

  It leaves other top-level folders alone.
- **Choosing what plays:** `logic.js` turns an override or schedule name into folders (`resolve`, `foldersFor`).
  - A plain name that isn't a configured season becomes `<today's season>/<name>`, so `photos` would not play `photos/` today.
  - `listVideos` keeps only `config.videoExtensions` and sorts with `compareNames` (`localeCompare`, numeric, base sensitivity).
  - `validSchedule` and `validSeasons` skip bad entries with an `ERROR: Ignoring …` line.
- **The website** (`website.js`) is a synchronous `handle({method, path, body})`.
  - It sits behind a server that reads at most 10,000 bytes of body and answers every response with `Cache-Control: no-store`.
  - Tests call `handle` directly with fake files.
  - The player and the website run in one Node process (`player.js` `main`).
- **mpv:**
  - It runs with `--hwdec=no` (quiet-hardware-decoding) and `--prefetch-playlist=yes`.
  - The box keeps three entries queued (`QUEUE_AHEAD`).
  - `--video-rotate` is added to a file's own rotation metadata, so portrait phone videos come out upright on the turned TV.
  - `scheduler/tests/fake_mpv.js` stands in for mpv in the tests.
- **Setup** runs unattended on a card's first boot (`cards/firstboot.sh`; systemd's stdin is null, so `[ -t 0 ]` is false). It runs interactively when the person reruns it over SSH.

## Goals / Non-Goals

**Goals:**
- Uploads of up to 1 GB over home Wi‑Fi, streamed to disk, without the website holding a file in memory or blocking the player's one-second tick.
- Refusals reach the phone before it sends a byte.
- The uploads' folder is owned by the website alone: sync, seasons and the schedule never write to it or play it on their own.

**Non-Goals:**
- Converting files on the box (HEIC to JPEG, H.264 to HEVC, shrinking 4K or very large photos). What the phone sends is what plays.
- Thumbnails made on the box: the phone's browser draws previews from the files themselves.
- Uploads on a schedule, or mixed into seasons.
- Asking for the PIN in the card maker. That's a possible follow-up; the card maker's own change (make-tvbox-cards) isn't archived yet.
- Backing up uploads, or copying them between boxes.

## Decisions

**1. Uploads live in `~/video-scheduler/photos/`, and `photos` is a kept name.**
- `resolve('photos')` returns `photos` before any season logic, and `foldersFor('photos')` is `['photos']`, with or without seasons.
- `validSeasons` rejects a season named `photos`, and `validSchedule` rejects a period whose playlist is `photos`. Each logs an `ERROR: Ignoring …` line saying why. So the only way to play uploads is an override from the website.
- **Sync:** `sync_videos.sh` skips `photos` in both loops. The first loop drops `playlists/photos` and every folder under it. The second loop never descends into the box's `photos/`. The skip is logged once per sync, only when the repo has `playlists/photos`.
- The website's preview list leaves out `photos` (and anything under it) and offers it as its own `photos: true` choice.
- *Alternative:* a folder outside `~/video-scheduler` (e.g. `~/tvbox-uploads`). Rejected: the player's paths are all relative to `videoRoot`, and keeping everything there means one folder to look in. The kept name guards the overlap with sync.

**2. Photo files play only in `photos`, in upload order.**
- `listVideos(folders, withPhotos)` takes a flag, set for the `photos` playlist: it then also accepts `config.photoExtensions` (`jpg`, `jpeg`, `png`). Season folders keep `videoExtensions` only, so a stray poster image in the repo never shows.
- **Order comes from the number at the front of each name** (Decision 4), which `compareNames` sorts numerically, so `00010` follows `00009`, and the number keeps counting past `99999`.
- *Alternative, rejected in the design review:* a time-stamp prefix. Uploads in the same second, which is common when several photos are picked at once, then sort by their original names, and a `-2` clash suffix sorts before the original.
- The missing-folder and empty-folder warnings for `photos` use the same text, `No photos or videos uploaded yet. Showing black until one is added.`. They're logged with `warnOnce`, not `ERROR:`, instead of telling the person to add the folder to the repo.

**3. mpv options, set once at start: `mpvArgs(box, config)`.**
- `--image-display-duration=<config.photoSeconds>`.
- `--keepaspect=yes --panscan=0` fit the picture with black bars, never cropped.
- `--background=color --background-color=#000000` put black behind transparent PNGs; mpv 0.38+ otherwise may draw a checkerboard. Only mpv's GPU output paints the background, so this is a box-only check: in Docker, mpv has no GPU output, and both `--vo=image` and screenshots ignore the option.
- mpv treats a still as a file that ends after that time, so `keepPlaying` needs no change: photos queue and finish like videos.
- `--hwdec=drm --hwdec-codecs=hevc` replaces `--hwdec=no`. The codec list is checked before any hardware decoder is set up, so only HEVC tries the Pi 5's decoder (Raspberry Pi's ffmpeg build provides it through DRM PRIME). H.264 never tries hardware, and the CUDA/Vulkan probing lines that quiet-hardware-decoding removed stay gone.
- *Alternative:* a per-file option on `loadfile` chosen by probing the codec. Rejected: it needs `ffprobe` on every file, and mpv's per-codec list does the same thing.
- If `drm` doesn't work with `--vo=gpu` on the real box (for example, 10-bit HDR iPhone clips), `drm-copy` is the fallback (a box-only check).

**4. Upload transport: check the batch, then one raw POST per file, streamed.**
- **The page:**
  1. It sends one check for the whole batch (`POST /api/uploads/check`). Type and size rules live only on the box, so the page doesn't repeat them.
  2. Only after `ok`, it sends each file as `POST /api/uploads?name=<original name>`, with the file as the body, `Content-Length`, and the PIN in `X-Upload-Pin`. It uses `XMLHttpRequest` for upload progress, one file after another.
- **The early refusal is the check, not the upload's own answer.** Browsers often show a response only after the whole body is sent, and Node drains a refused body to the end, so a refusal sent mid-upload would arrive only after the full upload. The upload route still makes every check itself, since the batch check is only advisory.
- No multipart parsing (no npm packages on the box). The server routes the upload path, before reading any body, to a new async `receiveUpload({ name, pin, length, stream })`. The 10,000-byte limit stays for every other route.
- **Order of checks** (shared by the check and the upload; all before a byte is read):
  1. a PIN is set;
  2. not locked out;
  3. the PIN is right;
  4. every type is allowed;
  5. every length is present and ≤ 1 GB;
  6. free space − total ≥ 2 GB.

  Free space comes from `fs.statfsSync(videoRoot)` (Node ≥ 18.15; the box has 20), as an injected `freeBytes()`.
- **Writing:** the body streams into `photos/.upload-<random>`, created with `wx`, so a hidden part never plays and never lists.
  - When exactly `length` bytes have arrived, the final name is chosen and the part is linked to it with `fs.linkSync`, which fails rather than overwrite, and then the part is unlinked.
  - If the link fails because two uploads finished at once, the next number is taken and it tries again.
  - Any other ending (the phone closing early, an error) deletes the part and logs `Upload of … stopped partway; nothing kept.`
- **Names:** `pad5(highest number in photos/ + 1) + '-' + clean(original)`, where `clean` follows the requirement's rules.
  - It decodes `?name=` with a `try` around `decodeURIComponent`: a malformed `%` refuses the request as `Bad request.`.
  - The saved name comes only from this, so it can't escape `photos/`.
- **Timeouts:** the server is created with `http.createServer({ requestTimeout: 0 }, …)`, because Node's 5-minute default can cut off a 1 GB upload on slow Wi‑Fi. It keeps `headersTimeout`, and an idle socket still ends after `server.timeout = 120000` (2 minutes with no data), which also covers the page's polling sockets.

**5. The PIN.**
- It's kept in `~/video-scheduler/upload-pin`, mode 600, owned by the person's user, who the player runs as.
- The website reads it with `readText` on every PIN check, so a PIN changed by setup works without a restart. Content that isn't `^\d{4,8}$` once trimmed counts as no PIN.
- It's compared with `crypto.timingSafeEqual` on equal-length buffers.
- **Lockout:** an in-memory count of wrong or missing PINs in a row, shared by the check, uploads and removals.
  - On the fifth, `lockedUntil = now + 5 min` and the lock is logged.
  - A right PIN resets the count.
  - A restart clears it. On a 4-digit PIN that allows guessing over days by someone on the home network, which is accepted (see Risks).
- **Setup:**
  1. At the very start, before `apt-get`, it validates `TVBOX_UPLOAD_PIN` (or exits 1 with `The upload PIN must be 4 to 8 digits.`).
  2. If none is given and no PIN file exists and `[ -t 0 ]`, it asks with `read -rs` until it gets a valid PIN. EOF is handled under `set -e` by falling through to "no PIN".
  3. Later, where it makes the video folder, it writes the PIN under `umask 077` to a `.new` file and renames it into place (owned via `owned`), so the file is never even briefly readable by others. Otherwise it keeps an existing file, or prints the "No upload PIN set…" line.
  4. It `mkdir -p`s `photos/`.

  With `TVBOX_ROOT` set (tests), ownership is skipped as it is today.

**6. Removing takes the upload off mpv first.**
- `POST /api/uploads/remove`, with `{ name }` and the PIN header. The name must be exactly one of the listed uploads (the same filter as the list), so `..`, hidden files and anything else fail with `No upload named …`.
- The website then awaits an injected `beforeRemove(path)`, which `main` wires to a new `player.dropFile(path)`. That reads mpv's playlist and `playlist-remove`s every entry with that filename, from the last index down. mpv moves on to the next entry when the playing one is removed.
- It then deletes the file with `fs.rmSync` and logs it.
- `handle` becomes async and receives `headers`. Existing tests await it.
- `scheduler/tests/fake_mpv.js`: removing the playing entry must start the next one, as mpv does, instead of going idle.

**7. Sending files.**
- `GET /photos/<name>`, with the name checked against the list as above.
- **Headers:**
  - `Content-Type` by extension (`image/jpeg`, `image/png`, `video/mp4`, `video/quicktime`, `video/x-m4v`);
  - `Accept-Ranges: bytes`;
  - `Cache-Control: max-age=31536000, immutable`: an upload's name never changes, and a removed one is never reused: the last number given is kept in the hidden `photos/.last-number`, so removing the newest upload doesn't free its number.
- **Ranges:** one range per request: `bytes=a-b`, `bytes=a-` and `bytes=-n`. The answer is 206 with `Content-Range`, or 416 with `bytes */<size>` when the range is past the end. Safari won't play a `<video>` without range support.
- It streams with `fs.createReadStream({start, end})`.
- For testing, a pure `fileResponse(urlPath, rangeHeader)` (the whole `/photos/…` path, decoded inside) returns `{status, headers, path, start, end}` (or the 404 or 416), and the server streams it.

**8. The page.** A new "Add photos or videos" section:
- `<input type="file" accept="image/*,video/*" multiple>` and a PIN field, saved in `localStorage` (inside try/catch).
- The batch flow is a function in the page script, `sendBatch(files, pin, api, ui)`, so the tests can run it in `vm` with a fake `api`:
  1. check;
  2. on `Wrong PIN.` or a lock, forget the PIN, empty the field, and stop;
  3. otherwise send each file in order, showing each answer, and stop at the first refusal.
- The uploads list: `<img loading="lazy">` for photos, and `<video preload="metadata" muted playsinline src="…#t=0.1">` for videos, each with a Remove button.
- `Adding photos is off until a PIN is set on the box.` replaces the picker when `pinSet` is false.
- A Photos button next to the previews posts `show photos` with the chosen duration.

### API

| Route | Request | Success | Refusals |
|---|---|---|---|
| `GET /api/uploads` | – | 200 `{ pinSet, uploads: [{ name, kind: 'photo'\|'video', bytes }] }` in play order | – |
| `POST /api/uploads/check` | header `X-Upload-Pin`; body `{ files: [{ name, bytes }] }` | 200 `{ message: 'Ready to add N files.' }` | 403 `Wrong PIN.` / `Adding photos is off…`; 429 `Too many wrong PINs…`; 400 type; 413 too big; 507 no room |
| `POST /api/uploads?name=…` | header `X-Upload-Pin`, `Content-Length`; raw body | 200 `{ message: 'Added <name>.' }` | as check; 400 `Bad request.` (no length, bad name); a stopped upload gets no answer (the socket is gone) |
| `POST /api/uploads/remove` | header `X-Upload-Pin`; body `{ name }` | 200 `{ message: 'Removed <name>.' }` | 403, 429 as above; 404 `No upload named <name>.` |
| `GET /photos/<name>` | optional `Range` | 200 or 206, file bytes | 404 `Not found.`; 416 |

Refusals are `{ error }`, as today. `GET /api/choices` gains `photos: true`, and its `previews` leave out `photos`.

### How each scenario's test reaches it

- **`website.test.js`, through `handle` with the existing fakes:** the choices and Photos-button scenarios, and the page scenario that checks the HTML. As today, it also checks that the page script compiles.
- **`website.test.js`, through `receiveUpload`, `handle` (check, list, remove) and `fileResponse`:** the upload, check, list, send and remove scenarios.
  - These run against a real temporary `videoRoot` with the player's `realIo()`, plus an injected `now()`, `freeBytes()`, `log` and a recording `beforeRemove`.
  - Bodies are `Readable.from(buffers)`; "stops partway" is a stream that ends early, with the declared length larger.
  - The 1 GB and 600 MB cases only declare the length, and their body stream throws if read.
- **`website.test.js`, `sendBatch` run from the page script in `vm`** with a fake `api` and `ui`: the two page batch scenarios.
- **`scheduler.test.js`**, using the fake mpv and fake folders as the playlist tests do now:
  - the Photos scenarios, through `whatToShow`, `createPlaylist` and `keepPlaying`;
  - the kept season name through `validSeasons`, and the kept schedule name through `validSchedule`.
- **`player.test.js`:**
  - the photo time and HEVC through `mpvArgs(config.box, config)`;
  - the two removal scenarios: a player with the fake mpv playing `photos`, and a website whose `beforeRemove` is `player.dropFile`. The test asserts mpv's playlist and the log after the website's remove.
- **`sync.test.js`:** the real script against throwaway repos, as today.
- **New `setup.test.js`:** runs `setup.sh` with `TVBOX_ROOT`/`TVBOX_USER`/`TVBOX_HOME`, with fake `apt-get`, `systemctl`, `timedatectl`, `usermod`, `groupadd` and `getent` first on `PATH`, and stdin from `/dev/null` (no terminal). That's the dry run the skill describes. The interactive prompt is a box-only check.

### Rehearsal

This change touches `setup.sh`, `sync_videos.sh`, `player.js`, `mpv.js` and `website.js`, so the rehearsal runs. Existing checks still cover setup, sync, status, frames and rotation. The rehearsal's fake mpv plays with `--vo=null` and saves a screenshot twice a second, because `--vo=image` runs untimed: on a fast machine a 2-second clip or a 10-second photo was over in a fraction of a second, so the `playing` log lines that several checks wait for never appeared. New checks in `inside.sh`:
1. **First boot without a PIN** (the card's real flow): setup prints `No upload PIN set…`, writes no `upload-pin`, and makes `photos/`. Then setup is rerun with `TVBOX_UPLOAD_PIN=4321`: `upload-pin` is mode 600.
2. **Uploading with curl:**
   - a check with a wrong PIN answers 403 `Wrong PIN.`;
   - with the right PIN, a JPEG made with ffmpeg is added and the log has `Uploaded photos/00001-…`;
   - `GET /api/uploads` lists it.
3. **Orientation:** a JPEG with EXIF orientation 6 is uploaded and comes out upright in its Photos frame on the turned picture. The test makes it by inserting an APP1/Exif segment into an ffmpeg-made JPEG with a few lines of Node, since ffmpeg can't write the tag and there's no exiftool. Any fixture file goes under `scheduler/tests/e2e/fixtures/`.
4. **Transparency:** a PNG with a transparent half plays. Whether its transparent half is black on the TV is box-only: without the GPU output, mpv ignores `--background` (tried on mpv 0.40 in the rehearsal image with black, white and tiles: the frame was the same each time).
5. **HEVC:** a short clip made with ffmpeg's `libx265` (or a committed fixture if the Dockerfile's ffmpeg lacks it) plays.
   - frames are drawn;
   - there is no `ERROR: Skipping`, and no `libcuda`/`vulkan` lines.

   In Docker the `drm` decoder isn't there, so this proves the clip plays with the new options and falls back quietly. Hardware decoding itself is box-only.
6. **Photo time:** with two photos uploaded, `show photos` until cleared. The status is `photos (override until cleared)`, and the log's `photos: playing 00001-…` and `photos: playing 00002-…` lines are 8–15 seconds apart. Frames can't measure this: the rehearsal saves a screenshot twice a second, not one per frame.
7. **Removing:** remove the photo on screen with the PIN. The file is gone, the log has `Removed photos/…`, the next upload plays, and no `ERROR:` line follows.
8. **Sync:** with `playlists/photos/x.mp4` committed to the rehearsal repo, sync logs the skip once and leaves `photos/` as it was.

## Risks / Trade-offs

- [An iPhone sends HEIC] → HEIC is refused with a plain message rather than playing black. Box-only check with the person's iPhone; if it does, a follow-up converts with ffmpeg on upload.
- [Safari converts iPhone videos to H.264 ("Most Compatible"), so 4K lands on software decoding and stutters] → Box-only check with a default-settings 4K iPhone clip, recording which codec arrives. The README says to share at 1080p if a video stutters, for iPhone and Android alike. Converting on the box is a non-goal for now.
- [iPhone HEVC is 10-bit HDR (HLG / Dolby Vision): `drm` with `--vo=gpu` may not handle its frames, or colours look washed out] → Box-only check with an HDR clip. Fallback `drm-copy`; if colours are off, note it in the skill and suggest turning off HDR video on the phone.
- [Very large photos (48–200 MP) exceed the GPU's texture size and fail with `ERROR: Skipping …` or stall] → Box-only check with a full-resolution 48 MP JPEG; the rehearsal's software output can't show it. If it fails, a follow-up shrinks photos over 4096 px on upload with ffmpeg.
- [Photos come out sideways because ffmpeg's JPEG decoder ignores EXIF orientation] → Rehearsal check 3 shows it before the box. If it fails, rotate on upload with ffmpeg's autorotate.
- [Anyone on the Wi‑Fi can see the uploads through `/photos/…`] → Same trust as the rest of the website: home network only. Only adding and removing need the PIN. The uploads show on the street-facing TV anyway.
- [A 4-digit PIN can be guessed over days, and a restart clears the lock] → Accepted for a home network; the person can choose up to 8 digits.
- [The SD card fills] → The 2 GB floor. `.removed/` from sync isn't counted separately.
- [A big upload slows the player] → Streaming uses little CPU, the player's tick is independent, and mpv decodes in its own process. Box-only check: a 500 MB upload while the window plays.
- [The phone locks, or the person leaves Safari, during a big upload] → It stops partway and nothing is kept. The README says to keep the page open, and that iOS may spend a while "Preparing" a video before the upload starts.
- [Uploads exist on one box only and aren't backed up] → Stated in the README.

## Getting it onto the box

Anything under `scheduler/` changes, so after the PR is merged the person reruns setup over SSH:

```sh
ssh tvbox.local
cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh
```

Setup asks for the upload PIN first (once; later runs keep it). Afterwards:
- `tail ~/video-scheduler/scheduler.log` shows `Started.` and the `Seasons:` line, and no `libcuda`/`vulkan` lines when the next video starts.
- The website shows the Add photos or videos section and a Photos button.
- Upload one photo from the phone, then tap Photos for 15 minutes:
  - the status reads `photos (override until …)`;
  - the log has `Uploaded photos/00001-…` and `photos: playing 00001-…`;
  - the photo stays about 10 seconds.

Box-only checks:
- **iPhone Safari:**
  - the picker opens Photos;
  - a photo arrives as `.jpg`, not refused as HEIC;
  - note the codec a default-settings 4K video arrives in.
- **Android Chrome:** the picker offers Google Photos, and a cloud-only item uploads.
- **Video playback:**
  - a 4K HEVC (HDR) iPhone video plays smoothly, with mpv well under one core in `top`, else try `drm-copy`;
  - colours look right;
  - a portrait video is upright.
- **Photo display:**
  - a landscape photo shows with black bars, not cropped;
  - a 48 MP photo shows.
- **A big upload:** a 500 MB video uploads over Wi‑Fi without timing out, while the window keeps playing smoothly.
- **Setup's PIN prompt** over SSH comes before the package installs.

## Design review

Ran `review-opsx-design` as a read-only subagent on proposal, specs and design (Nov 4, 2026).

**BLOCKING** (settled with the user):
- **Name order wasn't upload order** (time-stamp prefixes; same-second uploads; `-2` sorting before the original). Settled by numbering uploads `00001-…`: Decisions 2 and 4, and the naming scenarios.

**WARNING:**
- **Refusals before the body reach the phone late, and a wrong remembered PIN locks out a batch.** Settled with the user: the page checks the whole batch first and stops at a wrong PIN (Decisions 4 and 8, the check and page scenarios).
- **The proposal said HEIC was "checked on the box".** Corrected to "to be checked". Added risks for Safari converting video to H.264 and for 10-bit HDR.
- **Sync's second loop could still move `photos/` subfolders.** Both loops skip it, logged once; the sync scenario now has a subfolder (Decision 1).
- **A schedule entry `photos` would play uploads on a schedule.** Settled with the user: ignored and logged (Decision 1, daily-schedule scenario).
- **The API contracts weren't written down.** Added the API table; `handle` becomes async with `headers`; `mpvArgs(box, config)`.
- **Large photos and the GPU texture limit.** Added a risk and a box-only check.
- **Removing a queued or playing upload logged an ERROR.** Settled with the user: it's taken off mpv first (Decision 6, two photos-playback scenarios, and fake mpv made to match mpv).
- **Previews were full-size with `no-store`.** `/photos/*` is now cacheable for a year, and names are never reused (Decision 7).
- **Rehearsal checks 3 and 5 weren't implementable as written.** EXIF bytes are now inserted with Node, and the photo time is measured from log lines.
- **The rehearsal didn't cover first boot without a PIN.** Added as check 1.

**SUGGESTION:**
- **Applied:**
  - split the mixed-state PIN scenarios;
  - spelled out the naming rules (ASCII, trimming, `upload` fallback, 60-character cap, malformed `%`);
  - a link-then-unlink rename that can't overwrite;
  - open-ended ranges and 416;
  - `createServer({ requestTimeout: 0 })`;
  - a black background for transparent PNGs;
  - the setup prompt first, with `read -rs`, EOF handling, and the file written under `umask 077`;
  - no `git` fake in the setup test;
  - the lockout's strength stated in Risks;
  - README notes on "Preparing" and keeping the page open.
- **Not applied:** none.
