## 1. The code

- [x] 1.1 Tests: the address code is a QR code of the box's address; it sits bottom-right however the TV faces
- [x] 1.2 `scheduler/address_code.js`: the address, `qrencode` text to BGRA pixels, the corner; `addressCode` in `config.js`

## 2. The player

- [x] 2.1 Tests: it shows for 3 seconds when an item starts; follows a new address; none without an address or when switched off; none on a black screen
- [x] 2.2 `player.js`: show and remove it through `overlay-add`/`overlay-remove`, and write `/run/tvbox/address-code.json`; the fake mpv in the tests takes the overlay commands

## 3. The website

- [x] 3.1 Tests: on until switched off; switched with no PIN; the switch on the page
- [x] 3.2 `website.js`: `GET`/`POST /api/address-code` and the checkbox under TV

## 4. Setup, emulator and rehearsal

- [x] 4.1 Test and `setup.sh`: install `qrencode` (also in the rehearsal's Dockerfile)
- [x] 4.2 The emulator's TV view draws the code from `/run/tvbox/address-code.json`
- [x] 4.3 The rehearsal checks the code is drawn and taken away

## 5. Rest

- [x] 5.1 README (the code, the switch, reserving the address on the router) and the schedule skill
- [ ] 5.2 Check on the real TV, both ways: the code is in the bottom-right and a phone opens the website from it
