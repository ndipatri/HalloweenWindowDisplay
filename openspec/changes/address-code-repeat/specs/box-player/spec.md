## ADDED Requirements

### Requirement: Shows its address again while an item stays on screen
While the same item stays on screen, the box SHALL show the address code again, for `addressCode.seconds`, each time `addressCode.every` seconds (10 as shipped) have passed since it last showed it, under the same conditions as when an item starts (switched on, an address, not black). A new item SHALL still show it at once.

#### Scenario: the address code shows again every 10 seconds while one item stays on screen
- **GIVEN** the box at 10.0.0.25 with the address code on, holding a single upload a on screen
- **WHEN** a starts, and then 10 and 20 seconds pass with a still on screen
- **THEN** the code is drawn when a starts, taken away 3 seconds later, and drawn again at 10 and at 20 seconds, for 3 seconds each time
- **AND** it is not drawn between those times

#### Scenario: a new item starts the 10 seconds again
- **GIVEN** the box showing the code when a started
- **WHEN** b starts 6 seconds later
- **THEN** the code is drawn when b starts
- **AND** it is next drawn 10 seconds after that, not 10 seconds after a started

#### Scenario: no repeated address code when switched off
- **GIVEN** a single upload a held on screen with the address code switched off
- **WHEN** 10 seconds pass
- **THEN** no code is drawn
- **AND** once it is switched back on, it is drawn within 10 seconds, with a still on screen
