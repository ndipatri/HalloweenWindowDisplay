## ADDED Requirements

### Requirement: Follows a tilt switch on the TV
When `tiltSwitch` is set in the configuration (off as shipped), the box SHALL read that pin every second and, once the switch has held a new position for 2 seconds, save the way the TV faces as the website's buttons do, so the picture turns to match. A way chosen on the website SHALL stay until the switch next moves. A switch that can't be read SHALL be logged once and otherwise ignored. Setup SHALL let the box read the pins.

#### Scenario: the box follows the tilt switch when the TV is turned
- **GIVEN** `tiltSwitch` `{ gpio: 17, closed: 'portrait' }`, the switch closed and the TV portrait
- **WHEN** the switch opens and stays open for 2 seconds
- **THEN** the box saves landscape, logs `Screen: landscape (from the tilt switch).`, and turns the picture by 0 degrees
- **AND** when it closes again for 2 seconds, the box saves portrait

#### Scenario: a tilt switch that flickers while the TV turns is ignored until it settles
- **GIVEN** `tiltSwitch` set, the switch closed and the TV portrait
- **WHEN** the switch reads open for 1 second, then closed again
- **THEN** nothing is saved and the picture isn't turned

#### Scenario: the website's choice stays until the tilt switch moves
- **GIVEN** `tiltSwitch` set and the switch closed (portrait)
- **WHEN** Landscape is chosen on the website and the switch stays closed
- **THEN** the TV stays landscape
- **AND** once the switch opens and closes again, it follows the switch

#### Scenario: a box with no tilt switch set never reads one
- **GIVEN** `tiltSwitch` null (as shipped)
- **WHEN** the box runs
- **THEN** it never reads a pin

#### Scenario: a tilt switch that can't be read is logged once
- **GIVEN** `tiltSwitch` set and a pin that can't be read
- **WHEN** the box runs for several seconds
- **THEN** it logs `WARNING: Couldn't read the tilt switch on GPIO17: ...` once, and the TV stays as it was

#### Scenario: the box reads the tilt switch with the pin pulled up
- **WHEN** the box reads the switch on GPIO17
- **THEN** it runs `gpioget --bias=pull-up --numeric GPIO17`
- **AND** takes `0` as closed, `1` as open, and anything else, or a failure, as unreadable

#### Scenario: setup lets the box read the tilt switch
- **WHEN** setup runs
- **THEN** it installs `gpiod` and adds the box's user to the `gpio` group
