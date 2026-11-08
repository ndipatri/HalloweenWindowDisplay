# Delta for box-player

## MODIFIED Requirements

### Requirement: Shows each photo for a set time
The box SHALL have mpv keep each photo on screen for the number of seconds set as `photoSeconds` in the configuration (10 as shipped), filling the screen (zoomed until there is no black around it, its edges cropped evenly) with black behind any transparent parts, then move on to the next item. Videos SHALL be fitted to the screen whole, with black around them.

#### Scenario: the box shows each photo for 10 seconds
- **GIVEN** the shipped configuration
- **WHEN** the box starts mpv
- **THEN** mpv is told to show each photo for 10 seconds
- **AND** mpv is told to fit the picture to the screen, not crop it, on a black background, unless an item says otherwise

#### Scenario: each photo fills the screen and each video is fitted whole
- **GIVEN** the uploads `00001-a.jpg`, `00002-b.mp4` and `00003-c.png`
- **WHEN** the box plays the tag `upload`
- **THEN** mpv is given each photo to fill the screen (`panscan=1.0` for that item)
- **AND** the video with no such option, so it is fitted whole
