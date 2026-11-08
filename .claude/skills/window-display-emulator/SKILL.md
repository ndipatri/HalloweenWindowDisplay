---
name: "window-display-emulator"
description: "Run, restart and test with the local tvBox emulator for HalloweenWindowDisplay: a whole box (setup, sync, player, website, mpv) in Docker on the Mac, with its website on localhost:8080 and a picture of the TV on localhost:8081. Use when the person is away from the real box, asks to deploy to or try something on the emulator or local box, or wants a website or player change checked by hand before it ships."
---

# The tvBox emulator

For ndipatri/HalloweenWindowDisplay. `scheduler/tests/e2e/emulate.sh` runs the box's own software on the box's OS (the rehearsal's `tvbox-e2e` Docker image, arm64) on the Mac, with the real videos from `playlists/`. It is how changes are tried by hand when the real box (a Raspberry Pi at tvbox.local) is out of reach, and a quick look before shipping even when it isn't. What the box does and how the website works is in the window-display-schedule skill; this one is only about running and using the emulator.

## What it is

- **The website:** http://localhost:8080/ (the box's http://tvbox.local/). From a phone on the same Wi‑Fi: `http://<this-mac>.local:8080/`.
- **The TV:** http://localhost:8081/ (`scheduler/tests/e2e/emulator/tv.js`): the newest frame mpv drew (about twice a second, no sound), turned as the TV on its side shows it, plus the status line. Black there when nothing has been drawn in the last two seconds.
- **Upload PIN:** `1234` (or `TVBOX_EMULATOR_PIN`).
- **Code:** this folder as it is when the emulator **starts**, uncommitted changes included. Sync "pulls" from this folder's current branch (its `origin` is the mounted folder), never from GitHub.
- **Clock:** the Mac's, in `TVBOX_TIMEZONE` (default America/New_York), so today's schedule applies. To see another season, play its filter under Play.
- **Container:** `tvbox-emulator`, run with `--rm`. Nothing is kept outside it.
- **Can't show:** smooth motion, sound, the real TV's colours, booting, Wi‑Fi. Those stay checks on the real box.

## Start it

Docker Desktop must be running (`docker info`); if it isn't, ask the person to start it. Start the emulator in the background so the session isn't blocked, then wait for the website to answer:

```bash
docker stop tvbox-emulator >/dev/null 2>&1
(bash scheduler/tests/e2e/emulate.sh > "$SCRATCH/emu.txt" 2>&1 &)
sleep 5; for i in $(seq 1 40); do curl -fsS localhost:8080/api/choices && break; sleep 3; done
```

(`$SCRATCH` is any scratch folder.) The first image build is slow (10+ minutes under arm64 emulation); later starts take under a minute. If Docker Hub can't be reached, it uses the image built before. Then open http://localhost:8080/ (and 8081 if the picture matters) in the browser pane for the person.

## Restart after every code change

The emulator copies the code only when it starts. **After any change to the code, stop and start it again** (the same commands as above), or the website and player are stale. When the person asks "is the website updated?", the answer depends on whether it was restarted since the last edit.

**A restart wipes the box:** uploads, tags, custom filters, overrides and the log all go. Say so before restarting when the person has put things on it (their photos disappearing after a restart is this, not a bug). On the real box an update never touches `~/video-scheduler/photos`.

## Putting test content on it

- **An upload without a phone:** the Mac has no ffmpeg, but the container does. Make the file there and send it to the website with the PIN:

  ```bash
  docker exec tvbox-emulator bash -c 'ffmpeg -loglevel error -y -f lavfi -i color=c=green:s=720x1280 -frames:v 1 /tmp/test.png && curl -sS -X POST -H "X-Upload-Pin: 1234" --data-binary @/tmp/test.png "localhost:8080/api/uploads?name=test.png"'
  ```

- **Tags, filters, Play:** through the page, or the API (`POST /api/tags`, `POST /api/filters` with `X-Upload-Pin: 1234`, `POST /api/show`); see the window-display-schedule skill for the bodies.

## Checking a change

1. Restart it on the current code and wait for `/api/choices` to answer.
2. Look at the API first: `curl -s localhost:8080/api/status`, `/api/choices`, `/api/items`.
3. Read the log: `curl -s localhost:8080/api/log` (the last 20 lines), or `docker exec tvbox-emulator tail -50 /home/pi/video-scheduler/scheduler.log`.
4. Look at the page at phone size: in the browser pane, `resize_window` preset `mobile`, reload, screenshot, try the change (tap, pick, Play), screenshot again. Reset with preset `desktop` when done.
5. For anything that plays, check the TV on 8081, or the log's `<what>: playing <file>` lines, not just the status line.

When something "doesn't show", check the status before suspecting a bug: an upload plays only when it is picked under Play (or is in a filter whose schedule is on now). Outside every schedule the window is black.

## Stopping

`docker stop tvbox-emulator`. Leave it running at the end of a session if the person is still using it.

## Related

- The rehearsal (`scheduler/tests/e2e/box.e2e.sh`, `inside.sh`) is the automated version in the same image: it checks the box end to end and is part of verifying a change. The emulator is for looking by hand.
- Shipping and updating the real box: the window-display-schedule skill.
