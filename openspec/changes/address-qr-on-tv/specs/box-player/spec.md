## ADDED Requirements

### Requirement: Shows its address on the TV as each item starts
When a new item starts on screen, the box SHALL show a QR code of its website's address (`http://<its IPv4 address>/`) in the corner that is bottom-right for someone looking at the TV, whichever way it faces, for `addressCode.seconds` (3 as shipped), then take it away, unless the address code is switched off or the box has no address. It SHALL draw it on top of the picture without changing it, and never while the screen is black.

#### Scenario: the address code shows for 3 seconds when an item starts
- **GIVEN** the box at 10.0.0.25 with the address code on, playing the uploads a and b
- **WHEN** a starts
- **THEN** mpv is told to draw the code of `http://10.0.0.25/` on top of the picture
- **AND** it is taken away 3 to 4 seconds later, while a is still on screen
- **AND** it is drawn again when b starts

#### Scenario: the address code sits bottom-right however the TV faces
- **GIVEN** a 1920×1080 panel and a 240-pixel code
- **WHEN** the picture is turned 0, 90, 180 or 270 degrees
- **THEN** the code is drawn 24 pixels in from the panel's bottom-right, bottom-left, top-left or top-right corner, in that order

#### Scenario: the address code is a QR code of the box's address
- **GIVEN** `qrencode`'s text output for `http://10.0.0.25/`
- **WHEN** the box makes the code
- **THEN** each dark module is black and each light one white, every module the same whole number of pixels, inside a white border two modules wide
- **AND** the whole code is at most 240 pixels square

#### Scenario: the address code follows a new address
- **GIVEN** the box showing the code of `http://10.0.0.25/`
- **WHEN** the router gives it 10.0.0.31 and the next item starts
- **THEN** the code drawn is of `http://10.0.0.31/`

#### Scenario: no address code without an address or when switched off
- **GIVEN** the box with no network address, or with the address code switched off
- **WHEN** an item starts
- **THEN** no code is drawn

#### Scenario: no address code on a black screen
- **GIVEN** the box showing the address code
- **WHEN** the screen goes black (nothing to play)
- **THEN** the code is taken away straight away

#### Scenario: setup installs qrencode for the address code
- **GIVEN** a fresh box
- **WHEN** setup runs
- **THEN** it installs `qrencode`
