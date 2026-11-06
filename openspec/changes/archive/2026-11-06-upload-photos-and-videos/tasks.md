# Tasks

## 1. Tests first (one per scenario, named exactly as the scenario)

- [x] 1.1 Make `handle` async in `scheduler/website.js` and pass `headers`, changing nothing else. Update the existing `website.test.js` calls to await it. In `scheduler/tests/fake_mpv.js`, make `playlist-remove` of the playing entry start the next one, as mpv does. Verify every existing test still passes.
- [x] 1.2 In `scheduler/tests/website.test.js`, through `handle` with the existing fakes, add `the website offers Photos apart from the season previews` and `the website page offers a Photos button`. Keep `the website lists what it can show` and `the website page offers each choice` passing. Verify the new tests fail on an assertion.
- [x] 1.3 In `scheduler/tests/website.test.js`, add an upload helper: a temporary `videoRoot` with `realIo()`, an injected `now()`, `freeBytes()`, log and recording `beforeRemove`, and `Readable.from` bodies (one that throws if read, for the size cases). Add `the website adds a photo with the right PIN`, `the website refuses an upload with the wrong PIN`, `the website refuses an upload with no PIN`, `the website refuses uploads while no PIN is set`, `a PIN file that isn't 4 to 8 digits leaves uploads off`, `five wrong PINs in a row lock uploads for five minutes`, `a right PIN starts the count of wrong PINs again`. Verify each fails on an assertion, not on a missing function: stub `receiveUpload` to answer 404 if needed.
- [x] 1.4 In the same file, add the naming, type, room and partial tests: `uploads are numbered in the order they arrived`, `numbering carries on after the highest upload`, `a name with nothing usable left is called upload`, `the website refuses a file that isn't a photo or video it can show`, `the website refuses a file over 1 GB`, `the website refuses an upload that would leave under 2 GB free`, `an upload that stops partway leaves nothing behind`. Verify each fails on an assertion.
- [x] 1.5 In the same file, add the batch-check tests: `the website clears a batch before it is sent`, `the website refuses a batch with the wrong PIN before it is sent`, `the website refuses a batch that wouldn't fit before it is sent`. Verify each fails on an assertion.
- [x] 1.6 In the same file, add the list, send and remove tests: `the website lists the uploads in the order they play`, `the website lists no uploads when there are none`, `the website sends an upload`, `the website sends part of a video when asked for a range`, `the website sends the rest of a video from a byte onwards`, `the website refuses a range past the end of an upload`, `the website sends nothing outside the uploads`, `the website removes an upload with the right PIN`, `the website refuses to remove an upload with the wrong PIN`, `the website refuses to remove something that isn't an upload`. Verify each fails on an assertion.
- [x] 1.7 In the same file, add the page tests: `the website page offers adding and removing photos` (the HTML), plus `the page sends a batch only after the box clears it` and `the page stops a batch at a wrong PIN and asks for it again`. The last two run the page script's `sendBatch` in `vm` with a fake `api` and `ui`. Verify each fails on an assertion.
- [x] 1.8 In `scheduler/tests/scheduler.test.js`, add `Photos plays the uploads on a season day`, `Photos plays the uploads on a day with no season`, `Photos plays the uploads when there are no seasons`, `Photos plays photos and videos in upload order, round and round`, `a photo in a season folder doesn't play`, `Photos with no uploads shows black and says so once`, `Photos with no photos folder shows black and says so once`, `a season named photos is skipped and logged` and `a schedule entry for photos is skipped and logged`. Verify each new test fails on an assertion, except `a photo in a season folder doesn't play`, which guards today's behaviour (noted for the disable check).
- [x] 1.9 In `scheduler/tests/player.test.js`, add `the box shows each photo for 10 seconds` and `the box decodes HEVC in hardware and H.264 in software` (on `mpvArgs`). Add `removing the upload on screen moves on to the next` and `removing a queued upload takes it out of the queue`: a player with the fake mpv playing `photos`, and a website whose `beforeRemove` is `player.dropFile`. Verify each fails on an assertion.
- [x] 1.10 In `scheduler/tests/sync.test.js`, add `sync skips a photos folder in the repo`. Verify it fails on an assertion.
- [x] 1.11 Create `scheduler/tests/setup.test.js`. It runs `setup.sh` dry with `TVBOX_ROOT`/`TVBOX_USER`/`TVBOX_HOME`, fake `apt-get`, `systemctl`, `timedatectl`, `usermod`, `groupadd` and `getent` first on `PATH`, and stdin from `/dev/null`. Add `setup saves the upload PIN it is given`, `setup keeps the saved upload PIN`, `setup refuses an upload PIN that isn't 4 to 8 digits`, `setup without a PIN or a terminal leaves adding photos off` and `setup makes the photos folder`. Verify the file runs and each test fails on an assertion.
- [x] 1.12 Run every test file and confirm only the new tests fail, each on an assertion. Run `node openspec/check-scenarios.js upload-photos-and-videos` and confirm it reports no missing tests.

## 2. Photos playback (logic, config, mpv, player)

- [x] 2.1 In `scheduler/config.js`, add `photoSeconds: 10`, `photoExtensions: ['jpg', 'jpeg', 'png']` and an `uploads` block (`maxBytes` 1 GB, `keepFreeBytes` 2 GB, `pinTries` 5, `lockMinutes` 5), each with a one-line comment. Verify `node --check scheduler/config.js`.
- [x] 2.2 In `scheduler/logic.js`, make `photos` a kept name:
  - `resolve` and `foldersFor` return it as it is;
  - `validSeasons` rejects a season named `photos`, and `validSchedule` a period playing `photos`, each with its reason;
  - `listVideos` accepts photo extensions only for `photos`;
  - a missing or empty `photos/` uses the `No photos or videos uploaded yet…` warning.

  Verify the 1.8 tests pass and every existing scheduler test still passes.
- [x] 2.3 In `scheduler/mpv.js`, make it `mpvArgs(box, config)`, adding `--image-display-duration`, `--keepaspect=yes`, `--panscan=0`, `--background=color`, `--background-color=#000000`, and `--hwdec=drm --hwdec-codecs=hevc` in place of `--hwdec=no`. Update the comment and `startMpv`'s caller. Verify the two `mpvArgs` tests pass.
- [x] 2.4 In `scheduler/player.js`, add `dropFile(path)`, which removes every mpv playlist entry with that filename, from the last down. In `main`, pass it to `startWebsite` as `beforeRemove`. Verify the two removal tests pass once 3.1 lands, and that every existing player test still passes.
- [x] 2.5 Update the window-display-schedule skill:
  - Playback: photos, the photo time, the black background, HEVC in hardware;
  - Files: `photos/` and `upload-pin`;
  - the kept name `photos`;
  - Troubleshooting rows for HEVC that stutters or looks washed out (`drm-copy`, HDR off on the phone) and for a photo `ERROR: Skipping` (very large photo).

  Verify the skill no longer says HEVC needs a re-encode or that mpv runs `--hwdec=no`.

## 3. Uploads on the website

- [x] 3.1 In `scheduler/website.js`, add the shared checks, the lock, `POST /api/uploads/check`, `receiveUpload`, `GET /api/uploads`, `fileResponse` and `POST /api/uploads/remove`:
  - uploads are numbered, written to a hidden part and linked into place;
  - remove awaits `beforeRemove`;
  - status codes and wording follow design.md's API table;
  - the choices gain `photos: true`, and `photos` is left out of the previews.

  Verify the 1.2–1.6 tests pass.
- [x] 3.2 In `startWebsite`:
  - route `POST /api/uploads` to `receiveUpload` before reading the body;
  - stream `GET /photos/…` from `fileResponse`, with its cache header (everything else stays `no-store`);
  - create the server with `{ requestTimeout: 0 }` and a 2-minute `timeout`;
  - pass `freeBytes` from `fs.statfsSync`.

  Verify `node --check scheduler/website.js`. Then start `startWebsite` alone on a spare port with a temporary `videoRoot`, and with `curl` check a batch, upload a file, fetch a range, and remove it.
- [x] 3.3 Add the page's Add photos or videos section:
  - the picker and the remembered PIN;
  - `sendBatch` (check first, then each file with progress; stop at the first refusal; forget the PIN on a wrong PIN or lock);
  - the uploads list with previews and Remove;
  - the no-PIN message, and the Photos button.

  Verify the 1.7 tests and `the website page offers a Photos button` pass, and the page script compiles.
- [x] 3.4 Update the README's "Using it" section:
  - adding photos and videos from the phone, and the PIN;
  - keeping the page open while a big video uploads (iOS may "Prepare" it first);
  - Photos on the website, and removing uploads;
  - that uploads live only on this box.

  Add "If something's wrong" rows for a refused HEIC photo and for a video that stutters (share at 1080p). Keep it in plain words, with no settings. Verify by reading it as the person would.

## 4. Setup and sync

- [x] 4.1 In `scheduler/setup.sh`:
  - validate `TVBOX_UPLOAD_PIN` and, with a terminal and no saved PIN, ask with `read -rs`, both before `apt-get`;
  - then save it (written under `umask 077` and renamed into place, so mode 600), keep a saved PIN, or print how to turn uploads on;
  - make `photos/`, and `owned` both;
  - document `TVBOX_UPLOAD_PIN` in the header comment.

  Verify the 1.11 tests pass.
- [x] 4.2 In `scheduler/sync_videos.sh`, skip `photos` in both loops (the repo-folder loop and the box-subfolder loop), logging the skip once per sync when the repo has `playlists/photos`. Verify `sync skips a photos folder in the repo` and every existing sync test pass.
- [x] 4.3 In the window-display-schedule skill:
  - add the PIN to setup's list (setting or changing it with `sudo TVBOX_UPLOAD_PIN=… bash scheduler/setup.sh`);
  - add design.md's API table to The website section;
  - add a Troubleshooting row for `Adding photos is off`.

  Verify against the code.

## 5. Verification

- [x] 5.1 Run `for f in scheduler/tests/*.test.js; do node "$f" || exit 1; done` and `node --check` on every changed `.js` file, and confirm they pass.
- [x] 5.2 Run `node openspec/check-scenarios.js upload-photos-and-videos` and confirm every scenario has its test.
- [x] 5.3 Disable check: temporarily revert the changed code under `scheduler/` (not the tests), rerun only the tests this change added or changed, confirm each fails, then restore the code. List any test that passes either way, with the reason, and fix any other. Expected to pass either way, because they guard existing behaviour: `a photo in a season folder doesn't play`, `the website lists what it can show`, `the website page offers each choice`. Result (in Debian, with `main`'s `config.js`, `logic.js`, `mpv.js`, `player.js`, `website.js`, `setup.sh` and `sync_videos.sh`): 48 of the 53 failed. Five passed either way: the three expected, `Photos plays the uploads when there are no seasons` (with no seasons a name was already used as it is, so it guards existing behaviour), and `setup keeps the saved upload PIN`, which didn't enforce its requirement: the old setup never touched the file. Fixed by starting from a PIN file anyone can read and checking that setup keeps the PIN and makes the file mode 600; it now fails on the old code.
- [x] 5.4 Add a table below mapping each scenario to its test file, listing a scenario only after its test passed the disable check.

### Scenarios and their tests (passed the disable check)

| Capability | Scenario | Test file |
|---|---|---|
| box-player | the box shows each photo for 10 seconds | `scheduler/tests/player.test.js` |
| box-player | the box decodes HEVC in hardware and H.264 in software | `scheduler/tests/player.test.js` |
| daily-schedule | a schedule entry for photos is skipped and logged | `scheduler/tests/scheduler.test.js` |
| override-website | the website offers Photos apart from the season previews | `scheduler/tests/website.test.js` |
| override-website | the website page offers a Photos button | `scheduler/tests/website.test.js` |
| photo-uploads | the website adds a photo with the right PIN | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses an upload with the wrong PIN | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses an upload with no PIN | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses uploads while no PIN is set | `scheduler/tests/website.test.js` |
| photo-uploads | a PIN file that isn't 4 to 8 digits leaves uploads off | `scheduler/tests/website.test.js` |
| photo-uploads | five wrong PINs in a row lock uploads for five minutes | `scheduler/tests/website.test.js` |
| photo-uploads | a right PIN starts the count of wrong PINs again | `scheduler/tests/website.test.js` |
| photo-uploads | uploads are numbered in the order they arrived | `scheduler/tests/website.test.js` |
| photo-uploads | numbering carries on after the highest upload | `scheduler/tests/website.test.js` |
| photo-uploads | a name with nothing usable left is called upload | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses a file that isn't a photo or video it can show | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses a file over 1 GB | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses an upload that would leave under 2 GB free | `scheduler/tests/website.test.js` |
| photo-uploads | the website clears a batch before it is sent | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses a batch with the wrong PIN before it is sent | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses a batch that wouldn't fit before it is sent | `scheduler/tests/website.test.js` |
| photo-uploads | an upload that stops partway leaves nothing behind | `scheduler/tests/website.test.js` |
| photo-uploads | the website lists the uploads in the order they play | `scheduler/tests/website.test.js` |
| photo-uploads | the website lists no uploads when there are none | `scheduler/tests/website.test.js` |
| photo-uploads | the website sends an upload | `scheduler/tests/website.test.js` |
| photo-uploads | the website sends part of a video when asked for a range | `scheduler/tests/website.test.js` |
| photo-uploads | the website sends the rest of a video from a byte onwards | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses a range past the end of an upload | `scheduler/tests/website.test.js` |
| photo-uploads | the website sends nothing outside the uploads | `scheduler/tests/website.test.js` |
| photo-uploads | the website removes an upload with the right PIN | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses to remove an upload with the wrong PIN | `scheduler/tests/website.test.js` |
| photo-uploads | the website refuses to remove something that isn't an upload | `scheduler/tests/website.test.js` |
| photo-uploads | the website page offers adding and removing photos | `scheduler/tests/website.test.js` |
| photo-uploads | the page sends a batch only after the box clears it | `scheduler/tests/website.test.js` |
| photo-uploads | the page stops a batch at a wrong PIN and asks for it again | `scheduler/tests/website.test.js` |
| photo-uploads | setup saves the upload PIN it is given | `scheduler/tests/setup.test.js` |
| photo-uploads | setup keeps the saved upload PIN | `scheduler/tests/setup.test.js` |
| photo-uploads | setup refuses an upload PIN that isn't 4 to 8 digits | `scheduler/tests/setup.test.js` |
| photo-uploads | setup without a PIN or a terminal leaves adding photos off | `scheduler/tests/setup.test.js` |
| photo-uploads | setup makes the photos folder | `scheduler/tests/setup.test.js` |
| photos-playback | Photos plays the uploads on a season day | `scheduler/tests/scheduler.test.js` |
| photos-playback | Photos plays the uploads on a day with no season | `scheduler/tests/scheduler.test.js` |
| photos-playback | Photos plays photos and videos in upload order, round and round | `scheduler/tests/scheduler.test.js` |
| photos-playback | Photos with no uploads shows black and says so once | `scheduler/tests/scheduler.test.js` |
| photos-playback | Photos with no photos folder shows black and says so once | `scheduler/tests/scheduler.test.js` |
| photos-playback | removing the upload on screen moves on to the next | `scheduler/tests/player.test.js` |
| photos-playback | removing a queued upload takes it out of the queue | `scheduler/tests/player.test.js` |
| seasons | a season named photos is skipped and logged | `scheduler/tests/scheduler.test.js` |
| video-sync | sync skips a photos folder in the repo | `scheduler/tests/sync.test.js` |

Pass either way, by design (they pin behaviour that already held and that this change must not break):

- `the website lists what it can show` (`scheduler/tests/website.test.js`): existing scenario, kept unchanged under the modified requirement.
- `the website page offers each choice` (`scheduler/tests/website.test.js`): existing scenario, kept unchanged under the modified requirement.
- `Photos plays the uploads when there are no seasons` (`scheduler/tests/scheduler.test.js`): guards today's behaviour: with no seasons a name was already used as it is.
- `a photo in a season folder doesn't play` (`scheduler/tests/scheduler.test.js`): guards today's behaviour: season folders already play only videos.

- [x] 5.5 Add design.md's eight rehearsal checks to `scheduler/tests/e2e/inside.sh`:
  1. first boot without a PIN, then the PIN set;
  2. check and upload with curl;
  3. an EXIF-rotated photo upright;
  4. a transparent PNG playing (black behind it is box-only);
  5. an HEVC clip playing quietly;
  6. photo time from the log;
  7. removing the photo on screen;
  8. sync skipping `playlists/photos`.

  Run `bash scheduler/tests/e2e/box.e2e.sh` and confirm every check passes. Record the result line (`N passed, 0 failed`) here.
  Result: the first run had 5 failures, all `playing …` log lines that never appeared: in the rebuilt rehearsal image `--vo=image` runs untimed, so each clip and photo was over in about 0.1 s (main's own mpv options too). The fake mpv now plays with `--vo=null` in real time and saves a screenshot twice a second. The transparent-PNG check moved to the box-only checks, since without the GPU output mpv ignores `--background`. No libx265 in the image, so the HEVC clip was skipped. Final run: `55 passed, 0 failed`.
- [x] 5.6 Run `openspec validate upload-photos-and-videos --strict` and fix what it reports.
- [x] 5.7 Implementation review: run `review-orchestrator` on the whole change against `origin/main` (code, tests, scripts, page, README, skill, OpenSpec artifacts) for the full report, telling its reviewers the project is Node built-ins, bash, mpv and systemd. Fix every BLOCKING finding, rerun every test file (and the rehearsal if a fix touches what it runs), and review again until no BLOCKING findings remain. Record each round's result here.
  - Round 1 (architecture, testing, performance, style): 3 BLOCKING, all fixed.
    - `/photos/` read streams were piped with `.pipe`, so a phone stopping partway left the file open (a removed video's space wasn't freed). They now use `stream.pipeline`.
    - Upload numbers could come back after the newest upload was removed, while `/photos/*` is cached as immutable. The last number is now kept in `photos/.last-number`. The test is `a removed upload's number is never given again`.
    - design.md and tasks.md said the PIN was written with `install -m 600`. They now describe the `umask 077` write and rename.
    - Warnings also fixed:
      - leftover `.upload-*` part files are removed at start;
      - `CONTENT_TYPES` falls back to `application/octet-stream`;
      - disk errors are logged as `ERROR:`;
      - `/api/show` refuses `photos/<anything>`;
      - the `path` shadowing is fixed;
      - the removal tests now also check that mpv lets go first and that a refusal takes nothing off the TV;
      - the sync test covers both loops' `photos` guard;
      - the exact range bytes are tested;
      - the rehearsal's remove check now needs the next upload within 5 s, and no ERROR a full round later.
  - Round 2 (the fixes): 0 BLOCKING. Two warnings, both fixed:
    - only the write stream's own errors count as a box failure (a phone timing out is not);
    - the counter is written atomically, and a failed write is only logged, since the upload is already saved.
  - Rehearsal after the fixes: `55 passed, 0 failed`. All Node test files pass in Debian.
  - Warnings left:
    - the removal order depends on promise-callback order (`removeFile` runs just after the serialised `dropFile`);
    - there is no reservation for uploads running at the same time in the free-space check;
    - a refused upload's body is still read to the end on keep-alive;
    - mpv has no extra read cache for SD-card stalls during big uploads (box-only check);
    - setup accepts Node 18.0 to 18.14, which lack `statfsSync` (the box has 20);
    - website.js isn't split into modules;
    - page tests don't run the real `forgetPin` or the no-PIN toggle;
    - `startWebsite`'s HTTP layer is covered only by the rehearsal.

## Workflow follow-up

- Ship as the window-display-schedule skill describes: branch, commit, push, PR through `gh api`; merge only when asked. Report the WARNING findings left from 5.7.
- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`. Setup asks for the upload PIN first. Then check the website (the Add photos or videos section, the Photos button) and the log (`Started.`, the `Seasons:` line, no `libcuda`/`vulkan` lines).
- Upload a photo from the phone and tap Photos: the status reads `photos (override …)`, and the photo stays about 10 seconds.
- Box-only: on iPhone Safari, photos arrive as `.jpg`; record the codec a default 4K video arrives in. On Android Chrome, the picker offers Google Photos and uploads a cloud-only item.
- Box-only: a 4K HDR HEVC iPhone video plays smoothly, with mpv well under one core in `top` (else try `drm-copy`), with colours right and a portrait video upright.
- Box-only: a landscape photo shows with black bars, not cropped, and a 48 MP photo shows.
- Box-only: a PNG with a transparent part shows black there, not a checkerboard.
- Box-only: a 500 MB upload over Wi‑Fi finishes while the window keeps playing smoothly.
- Box-only: setup's PIN prompt over SSH comes before the package installs.
- Archive the change once these checks pass.
