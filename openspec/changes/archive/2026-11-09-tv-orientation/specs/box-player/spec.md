## MODIFIED Requirements

### Requirement: Shows each photo for a set time
The box SHALL have mpv keep each photo on screen for the number of seconds set as `photoSeconds` in the configuration (10 as shipped), with black behind any transparent parts, then move on to the next item. A photo the same shape as the screen (portrait on a portrait TV, landscape on a landscape TV, judged as the photo is shown, after its EXIF orientation) SHALL fill the screen (zoomed until there is no black around it, its edges cropped evenly); any other photo, square or not measurable, SHALL be shown whole with black around it. Videos SHALL be fitted to the screen whole, with black around them. When the only item to play is one photo, the box SHALL queue it once and hold it on screen, rather than reloading it (which flashes black), and SHALL let it give way, without going black, as soon as something else is to play.

#### Scenario: the box shows each photo for 10 seconds
- **GIVEN** the shipped configuration
- **WHEN** the box starts mpv
- **THEN** mpv is told to show each photo for 10 seconds
- **AND** mpv is told to fit the picture to the screen, not crop it, on a black background, unless an item says otherwise

#### Scenario: each photo fills the screen and each video is fitted whole
- **GIVEN** the TV portrait and the uploads `00001-a.jpg` (portrait), `00002-b.mp4` and `00003-c.png` (portrait)
- **WHEN** the box plays the tag `upload`
- **THEN** mpv is given each photo to fill the screen (`panscan=1.0` for that item)
- **AND** the video with no such option, so it is fitted whole

#### Scenario: a lone photo is held on screen, not reloaded
- **GIVEN** the TV portrait and the one upload `00001-a.jpg` (portrait)
- **WHEN** the box plays the tag `upload` and keeps running
- **THEN** mpv is given the photo once, to fill the screen and stay (`panscan=1.0,image-display-duration=inf`)
- **AND** it is never queued again while it is the only item

#### Scenario: a held photo gives way when something else is to play
- **GIVEN** the box holding the lone upload `00001-a.jpg`
- **WHEN** `00002-b.jpg` is uploaded
- **THEN** b plays next, straight away
- **AND** the queue is b, a, b, each shown for the usual time

#### Scenario: a photo that isn't the screen's shape is shown whole
- **GIVEN** the TV portrait and the uploads `00001-wide.jpg` (landscape), `00002-square.png` (square) and `00003-broken.jpg` (not measurable)
- **WHEN** the box plays the tag `upload`
- **THEN** mpv is given each of them with no `panscan`, so each is shown whole

#### Scenario: a photo stored on its side is measured the way it is shown
- **GIVEN** JPEGs stored 160 wide and 96 high with EXIF orientation 6 or 8, and one with orientation 1
- **WHEN** the box measures them
- **THEN** the ones with orientation 6 and 8 are 96 wide and 160 high (portrait), and the other 160 wide and 96 high
- **AND** a PNG is measured from its header, and a file that isn't a JPEG or PNG has no size

## ADDED Requirements

### Requirement: Turns the picture for the way the TV faces
The box SHALL turn the picture by `rotate` from the configuration (90 as shipped) while the TV is portrait, and by `landscapeRotate` (0 as shipped) while it is landscape, as saved from the website; with nothing saved, the TV is portrait. When the saved way changes, the box SHALL turn the picture straight away without restarting, refit the item on screen for the new shape, and queue the items behind it again for the new shape.

#### Scenario: the box turns the picture when the TV is turned to landscape
- **GIVEN** the TV portrait, playing the uploads `00001-tall.jpg` (portrait) and `00002-wide.jpg` (landscape), with tall on screen and filling it
- **WHEN** the TV is saved as landscape
- **THEN** mpv turns the picture by 0 degrees
- **AND** tall, still on screen, is shown whole (panscan 0)
- **AND** the queue behind it is queued again, with wide filling the screen
- **AND** the box logs `Screen: landscape`

#### Scenario: a box started with the TV landscape turns the picture straight away
- **GIVEN** the TV saved as landscape
- **WHEN** the box starts
- **THEN** mpv turns the picture by 0 degrees before anything plays
