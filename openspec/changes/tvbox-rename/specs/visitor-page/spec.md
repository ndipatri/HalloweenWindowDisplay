## MODIFIED Requirements

### Requirement: The easy page is the box's front page
The website SHALL serve, at `/`, an easy page for visitors, titled tvBox, with a field for their name, a picker for photos and videos, a **Put them on the TV** button, and a link to the advanced page at `/advanced`. The QR code on the TV SHALL open this page.

#### Scenario: the easy page is at the box's address
- **WHEN** a phone opens `/`
- **THEN** it gets the easy page, titled tvBox, with the name field, the photo and video picker, no PIN field, **Put them on the TV**, and a link to `/advanced`

#### Scenario: the address code opens the easy page
- **GIVEN** the box at 10.0.0.25
- **WHEN** the address code is made
- **THEN** it is of `http://10.0.0.25/`, which serves the easy page
