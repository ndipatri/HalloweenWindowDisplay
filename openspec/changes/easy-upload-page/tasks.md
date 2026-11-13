## 1. The box's side

- [x] 1.1 Tests: a visitor's name becomes their tag; a name the box uses is refused; a name with no letters or numbers is refused; a returning visitor adds to their tag; each visitor upload is tagged with their name; a visitor upload needs the PIN; a visitor upload with a tag the box uses is refused
- [x] 1.2 `website.js`: `visitorTag`, `name` on `POST /api/uploads/check`, `tag` on `POST /api/uploads` (and the server passing it on)

## 2. The pages

- [x] 2.1 Tests: the easy page is at the box's address; the address code opens the easy page; the advanced page is at /advanced and links to the easy page; the visitor's pictures play until changed; nothing plays when an upload is refused; the easy page needs a name, the PIN and a file
- [x] 2.2 `EASY_PAGE` with `sendVisit` in its own script; `GET /` and `GET /advanced`; the link on the advanced page

## 3. Rehearsal and docs

- [x] 3.1 `inside.sh`: the advanced page at `/advanced`, the easy page at `/`, a visitor upload playing its tag
- [x] 3.2 README, the schedule skill and the emulator skill

## Workflow follow-up

- [ ] 4.1 On the real box: scan the QR code with a phone, add a photo with a name and the PIN, and see it play
