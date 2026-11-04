# Spec Delta

## ADDED Requirements

### Requirement: Shows each photo for a set time
The box SHALL have mpv keep each photo on screen for the number of seconds set as `photoSeconds` in the configuration (10 as shipped), fitted to the screen with black around it and behind any transparent parts, then move on to the next item.

#### Scenario: the box shows each photo for 10 seconds
- **GIVEN** the shipped configuration
- **WHEN** the box starts mpv
- **THEN** mpv is told to show each photo for 10 seconds
- **AND** mpv is told to fit the picture to the screen, not crop it, on a black background

### Requirement: Decodes HEVC videos in hardware
The box SHALL have mpv decode HEVC videos, which phones record, with the Raspberry Pi's hardware decoder, and SHALL keep every other codec, H.264 included, on software decoding without trying hardware first.

#### Scenario: the box decodes HEVC in hardware and H.264 in software
- **GIVEN** the shipped configuration
- **WHEN** the box starts mpv
- **THEN** mpv is told to use the `drm` hardware decoder for HEVC only
