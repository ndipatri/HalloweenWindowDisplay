## ADDED Requirements

### Requirement: Puts each picture on the TV as soon as it is drawn
The box SHALL have mpv keep at most one drawn frame waiting to be shown, so a photo (drawn only once or twice) reaches the TV as soon as mpv draws it, rather than waiting until later frames push it out.

#### Scenario: the box sends each picture to the TV as soon as it is drawn
- **GIVEN** the shipped configuration
- **WHEN** the box starts mpv
- **THEN** mpv is told to keep at most one drawn frame waiting (`--swapchain-depth=1`)
