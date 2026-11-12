## ADDED Requirements

### Requirement: Switches the address code on the TV
The website SHALL let anyone on the box's network switch the address code on the TV on or off, with no PIN, saved on the box (on when never set), and SHALL show the box's address as text beside the switch.

#### Scenario: the address code is on until switched off
- **GIVEN** a box where the address code was never switched
- **WHEN** the page asks for `GET /api/address-code`
- **THEN** it answers `{ show: true, url: "http://10.0.0.25/" }`

#### Scenario: the address code is switched off and on with no PIN
- **WHEN** `POST /api/address-code { show: false }` is sent with no PIN
- **THEN** the box saves it, and `GET /api/address-code` answers `show: false`
- **AND** `{ show: true }` turns it back on, and anything but true or false is refused

#### Scenario: the page has the address code switch under TV
- **WHEN** the page loads
- **THEN** under TV there is a checkbox "Show the box's address on the TV", ticked as the box has it
- **AND** the address is written beside it, or "No network address" when there is none
