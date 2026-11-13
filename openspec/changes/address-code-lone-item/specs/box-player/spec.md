## ADDED Requirements

### Requirement: Keeps its address on the TV while a single item plays
When what's playing has only one item, the box SHALL keep the address code up for as long as that item plays, instead of taking it away after `addressCode.seconds`, under the same conditions as when an item starts (switched on, an address, not black). If the code comes down while the single item stays (switched back on, the TV turned), the box SHALL show it again straight away. With two or more items it SHALL show the code for `addressCode.seconds` as each starts, as before.

#### Scenario: the address code stays up while a single item plays
- **GIVEN** the box at 10.0.0.25 with the address code on, playing a single upload a
- **WHEN** a starts and stays on screen for a minute
- **THEN** the code is drawn when a starts and is still up a minute later
- **AND** after the TV is turned, it is drawn again in the new corner straight away

#### Scenario: the address code comes down when a second item is added
- **GIVEN** the box playing a single upload a, with the code up
- **WHEN** a second upload b is added to what's playing
- **THEN** the code is taken away within 3 seconds
- **AND** from then on it shows for 3 seconds as each item starts, as with any two items

#### Scenario: no lone-item address code when switched off
- **GIVEN** a single upload a playing with the address code switched off
- **WHEN** a minute passes
- **THEN** no code is drawn
- **AND** once it is switched back on, it is drawn and stays up, with a still on screen
