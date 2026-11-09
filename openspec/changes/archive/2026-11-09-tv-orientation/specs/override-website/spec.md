## ADDED Requirements

### Requirement: Says which way the TV faces
The website SHALL let anyone on the home network say, without the PIN, whether the TV is now portrait or landscape. It SHALL save the choice on the box, log it, and offer Portrait and Landscape on the page, marking the one saved (portrait when nothing is saved).

#### Scenario: the website saves which way the TV faces
- **GIVEN** nothing saved about the TV
- **WHEN** someone posts `{"orientation": "landscape"}` to `/api/screen`
- **THEN** the box saves landscape and logs `Screen: landscape (from the website).`
- **AND** the answer says the picture is turned for a landscape TV
- **AND** `GET /api/screen` answers landscape (portrait before)

#### Scenario: the website refuses an unknown orientation
- **WHEN** someone posts `{"orientation": "sideways"}` to `/api/screen`
- **THEN** the answer is 400 and nothing is saved

#### Scenario: the page offers Portrait and Landscape
- **WHEN** someone opens the page
- **THEN** it has a TV section with Portrait and Landscape buttons, and marks the one the box has saved
