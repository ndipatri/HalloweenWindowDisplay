## Context

The player ticks every second and talks to mpv over its socket. mpv turns the picture for a TV on its side with `video-rotate` (270 for portrait as shipped), but anything drawn on top of the picture (mpv's OSD overlays) is in the screen's own coordinates and is not turned. The screen is the TV's panel, 1920×1080, wide side along the panel's long edge.

## Goals / Non-Goals

**Goals:** a phone on the home Wi‑Fi can open the website by scanning the TV; the code is small and brief, and never alters the photos or videos; it can be turned off.

**Non-Goals:** a fixed address (a DHCP reservation on the router does that, and the README says so); showing the code while the screen is black; HTTPS or names other than the number address.

## Decisions

**Drawn by mpv, with `overlay-add`.** The player makes the code as raw BGRA pixels in `/run/tvbox/address-code.bgra` and tells mpv `overlay-add 1 <x> <y> <file> 0 bgra <w> <h> <stride>`, then `overlay-remove 1` to take it away. The picture underneath is untouched, and the code keeps its size whatever plays. (Alternatives: burning it into each photo with ffmpeg changes the content and costs time per item; a second window isn't possible with mpv on DRM.)

**Made with `qrencode`, drawn by the player.** `qrencode -t ASCII -m 0 -l M <url>` prints the modules as text (`##` for dark, two spaces for light). `address_code.js` reads that into a grid and draws it at a whole number of pixels per module, inside a white border of 2 modules, about 1/8 of the panel's long side (240 px on 1920), so it scans from 2–3 m. No image library or npm package is needed; `qrencode` is a small Debian package. A QR code scans at any angle, so the code itself isn't turned.

**Where it goes.** The code goes in the corner that is bottom-right for someone looking at the TV, 24 px from the edges. With the picture turned by `video-rotate` degrees clockwise, the viewer's bottom-right is: 0 → the panel's bottom-right, 90 → bottom-left, 180 → top-left, 270 → top-right. The panel's size comes from mpv's `osd-width`/`osd-height`. (If the code lands in the wrong corner on the real TV, the mapping is the thing to fix; it is one table in `address_code.js`.)

**When.** Each tick, the player reads mpv's `path`. When it changes to a new item, the player shows the code (if switched on and the box has an address) and notes the time; once `addressCode.seconds` (3) have passed, or the screen goes black, it removes it. A new item while the code is up restarts the 3 seconds. The ticks are a second apart, so the code is up 3–4 s. The address and the code's file are made again only when the address changes.

**The address.** The first IPv4 address that isn't loopback, from Node's `os.networkInterfaces()`, preferring `wlan0`, then `eth0`, then any. The URL is `http://<address>/` (with `:<port>` if the website isn't on 80).

**The switch.** `~/video-scheduler/address-code.json` holds `{ "show": true|false }`; missing or unreadable means on. `GET /api/address-code` gives `{ show, url }` (url null with no address); `POST /api/address-code { show }` saves it, with no PIN, like `/api/screen`. The page shows a checkbox under TV with the address beside it as text. The player reads the file on each new item, so a change applies from the next item.

**The emulator.** Its mpv has no picture output, so screenshots show no overlays. The player also writes `/run/tvbox/address-code.json` (`{ "showing": bool, "x", "y", "size" }`), and the emulator's TV view draws the code from the `.bgra` file at that place while `showing` is true. The rehearsal checks the log, that file and the overlay commands.

## Risks / Trade-offs

- **mpv's overlays on DRM:** `overlay-add` is drawn by the OSD, which this box runs with `--osd-level=0`. That setting only governs mpv's own messages, not overlays, but this needs checking on the real TV, not only in Docker. → Checked on the real box before merging.
- **The corner mapping** depends on which way the TV is mounted; it is only checkable on the real TV. → One table; checked on the real box in both orientations.
- **The code is up about a third of the time during a photo show** (3 of every 10 s). → The switch turns it off; `addressCode.seconds` changes it.
- **Anyone who can see the TV can find the address.** The TV is mostly inside; uploads still need the PIN. → The switch.
