## MODIFIED Requirements

### Requirement: Shows each photo for a set time
The box SHALL have mpv keep each photo on screen for the number of seconds set as `photoSeconds` in the configuration (10 as shipped), with black behind any transparent parts, then move on to the next item. A photo the same shape as the screen (portrait on a portrait TV, landscape on a landscape TV, judged as the photo is shown, after its EXIF orientation) SHALL fill the screen (zoomed until there is no black around it, its edges cropped evenly); any other photo that plays (square, or played because nothing is the screen's shape) SHALL be shown whole with black around it. Videos SHALL be fitted to the screen whole, with black around them. When the only item to play is one photo, the box SHALL queue it once and hold it on screen, rather than reloading it (which flashes black), and SHALL let it give way, without going black, as soon as something else is to play.

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
- **GIVEN** the TV portrait and only landscape uploads, `00001-wide.jpg` and `00002-wide.png`
- **WHEN** the box plays the tag `upload` (nothing being the TV's shape, it plays them all)
- **THEN** mpv is given each of them with no `panscan`, so each is shown whole

#### Scenario: a square photo plays either way, shown whole
- **GIVEN** the TV portrait and the uploads `00001-square.png` (square), `00002-broken.jpg` (not measurable), `00003-wide.jpg` (landscape) and `00004-tall.jpg` (portrait)
- **WHEN** the box plays the tag `upload`
- **THEN** square (with no `panscan`, shown whole) and tall are queued, and not broken or wide
- **AND** the box logs once that it is leaving broken out: `WARNING: Leaving out 00002-broken.jpg in #upload: it can't be measured, so it may not play. It plays only when nothing else does.`
- **AND** with the TV landscape, square and wide are queued, and not broken

#### Scenario: a photo stored on its side is measured the way it is shown
- **GIVEN** JPEGs stored 160 wide and 96 high with EXIF orientation 6 or 8, and one with orientation 1
- **WHEN** the box measures them
- **THEN** the ones with orientation 6 and 8 are 96 wide and 160 high (portrait), and the other 160 wide and 96 high
- **AND** a PNG is measured from its header, and a file that isn't a JPEG or PNG has no size

#### Scenario: a video's shape is measured the way it is shown
- **GIVEN** MP4s 1920 wide and 1080 high, one with a 90° rotation matrix, one with its `moov` after its `mdat`, and one with an audio track before the video
- **WHEN** the box measures them
- **THEN** the turned one is 1080 wide and 1920 high, and the others 1920 wide and 1080 high
- **AND** a file that isn't an MP4 has no size

### Requirement: Turns the picture for the way the TV faces
The box SHALL turn the picture by `rotate` from the configuration (90 as shipped) while the TV is portrait, and by `landscapeRotate` (0 as shipped) while it is landscape, as saved from the website; with nothing saved, the TV is portrait. When the saved way changes, the box SHALL turn the picture straight away without restarting, refit the item on screen for the new shape (or move on from it, when it no longer matches the TV), and queue the items behind it again for the new shape.

#### Scenario: the box turns the picture when the TV is turned to landscape
- **GIVEN** the TV portrait, playing the uploads `00001-tall.jpg` (portrait) and `00002-wide.jpg` (landscape), with tall on screen and filling it
- **WHEN** the TV is saved as landscape
- **THEN** mpv turns the picture by 0 degrees
- **AND** tall, no longer the TV's shape, gives way at once to wide, which fills the screen
- **AND** the box logs `Screen: landscape`
- **AND** when the TV is saved as portrait again, tall comes back, filling the screen

#### Scenario: a box started with the TV landscape turns the picture straight away
- **GIVEN** the TV saved as landscape
- **WHEN** the box starts
- **THEN** mpv turns the picture by 0 degrees before anything plays

## ADDED Requirements

### Requirement: Plays only items the TV's shape
Of the items picked to play (by a filter's schedule or an override), the box SHALL play only those the TV's shape (portrait items while the TV is portrait, landscape ones while it is landscape), as measured after their rotation; square items SHALL play either way. Items that can't be measured SHALL play only when none of the picked items is the TV's shape (and leaving one out SHALL be logged once): then the box SHALL play them all, shown whole, and log that once.

#### Scenario: only items the TV's shape play
- **GIVEN** the uploads `00001-tall.jpg`, `00002-tall.mp4` (portrait), `00003-wide.jpg` and `00004-wide.mp4` (landscape)
- **WHEN** the box plays the tag `upload` with the TV portrait
- **THEN** only the tall photo and video are queued
- **AND** with the TV landscape, only the wide photo and video

#### Scenario: with nothing the TV's shape, everything plays, shown whole
- **GIVEN** the TV landscape and the uploads `00001-a.jpg` and `00002-b.mp4`, both portrait
- **WHEN** the box plays the tag `upload` for a while
- **THEN** both are queued, the photo with no `panscan`
- **AND** the box logs `Nothing in #upload is landscape, so it all plays, shown whole.` once

#### Scenario: an item that can't be measured plays only when nothing matches the TV
- **GIVEN** the TV portrait and the uploads `00001-broken.jpg` (not measurable) and `00002-wide.jpg` (landscape)
- **WHEN** the box plays the tag `upload`
- **THEN** both are queued, and the box logs `Nothing in #upload is portrait, so it all plays, shown whole.`
