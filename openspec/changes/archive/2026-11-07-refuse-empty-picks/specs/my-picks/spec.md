# Spec Delta

## ADDED Requirements

### Requirement: My picks needs something picked
The website SHALL refuse to show `picks` while nothing on the box is picked, saying so and writing no override, so the window stays as it was.

#### Scenario: the website refuses My picks while nothing is picked
- **GIVEN** a `thanksgiving` folder with `dusk.mp4`, and no picks file, then a picks file holding just `halloween/gone.mp4`
- **WHEN** the website is asked each time to show `picks` until switched back
- **THEN** each request is refused with `Nothing is picked yet. Tick something under My picks first.`
- **AND** no override file is written
