## REMOVED Requirements

### Requirement: Plays only items the TV's shape
**Reason**: Replaced by "Plays only what fits the TV", "Items that can't be measured need a shape tag" and "Shows black when nothing is the TV's shape": with nothing the TV's shape, the box now shows black instead of playing everything, and items that can't be measured no longer play.
**Migration**: Tag an item `portrait` or `landscape` to have it play that way.

## MODIFIED Requirements

### Requirement: Shows each photo for a set time
The box SHALL have mpv keep each photo on screen for the number of seconds set as `photoSeconds` in the configuration (10 as shipped), with black behind any transparent parts, then move on to the next item. A photo the same shape as the screen (portrait on a portrait TV, landscape on a landscape TV, judged as the photo is shown, after its EXIF orientation) SHALL fill the screen (zoomed until there is no black around it, its edges cropped evenly); any other photo that plays (square, or tagged with a shape it isn't) SHALL be shown whole with black around it. Videos SHALL be fitted to the screen whole, with black around them. When the only item to play is one photo, the box SHALL queue it once and hold it on screen, rather than reloading it (which flashes black), and SHALL let it give way, without going black, as soon as something else is to play.

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
- **GIVEN** the TV portrait and the landscape uploads `00001-wide.jpg` and `00002-wide.png`, both tagged `portrait`
- **WHEN** the box plays the tag `upload`
- **THEN** mpv is given each of them with no `panscan`, so each is shown whole

#### Scenario: a square photo plays either way, shown whole
- **GIVEN** the TV portrait and the uploads `00001-square.png` (square), `00002-broken.jpg` (not measurable), `00003-wide.jpg` (landscape) and `00004-tall.jpg` (portrait)
- **WHEN** the box plays the tag `upload`
- **THEN** square (with no `panscan`, shown whole) and tall are queued, and not broken or wide
- **AND** the box logs once that it is leaving broken out: `WARNING: Leaving out 00002-broken.jpg in #upload: it can't be measured. Tag it portrait or landscape to play it.`
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

## ADDED Requirements

### Requirement: Plays only what fits the TV
Of the items picked to play, the box SHALL play only those the TV's shape (portrait while the TV is portrait, landscape while it is landscape); square items SHALL play either way. An item's shape SHALL be the tag `portrait` or `landscape` when it has exactly one, otherwise its measured shape after its rotation. A shape tag SHALL NOT change how a photo is fitted.

#### Scenario: only items the TV's shape play
- **GIVEN** the uploads `00001-tall.jpg`, `00002-tall.mp4` (portrait), `00003-wide.jpg` and `00004-wide.mp4` (landscape)
- **WHEN** the box plays the tag `upload` with the TV portrait
- **THEN** only the tall photo and video are queued
- **AND** with the TV landscape, only the wide photo and video

#### Scenario: a shape tag decides which way an item plays
- **GIVEN** the uploads `00001-tall.jpg`, `00002-wide.mp4` tagged `portrait`, and `00003-wide.jpg`
- **WHEN** the box plays the tag `upload` with the TV portrait
- **THEN** the tall photo and the wide video are queued, the video with `panscan=0`
- **AND** with the TV landscape, only the wide photo

#### Scenario: a photo tagged with the other shape is shown whole
- **GIVEN** the TV portrait and the uploads `00001-wide.jpg` tagged `portrait` and `00002-tall.jpg`
- **WHEN** the box plays the tag `upload`
- **THEN** the wide photo is queued with `panscan=0` and the tall one with `panscan=1.0`

#### Scenario: an item tagged both portrait and landscape keeps its measured shape
- **GIVEN** the TV portrait and the uploads `00001-tall.jpg` and `00002-wide.jpg` tagged both `portrait` and `landscape`
- **WHEN** the box plays the tag `upload`
- **THEN** only the tall photo is queued

### Requirement: Items that can't be measured need a shape tag
An item whose shape can't be measured and that has no shape tag SHALL NOT play, and leaving it out SHALL be logged once.

#### Scenario: an item that can't be measured doesn't play until it has a shape tag
- **GIVEN** the TV portrait and the uploads `00001-broken.jpg` (not measurable) and `00002-wide.jpg` (landscape)
- **WHEN** the box plays the tag `upload`
- **THEN** nothing is queued, and the box logs once `WARNING: Leaving out 00001-broken.jpg in #upload: it can't be measured. Tag it portrait or landscape to play it.`
- **AND** once `00001-broken.jpg` is tagged `portrait`, it is queued

### Requirement: Shows black when nothing is the TV's shape
When none of the picked items is the TV's shape, the box SHALL show black, and log that once, until something is or the TV is turned back.

#### Scenario: with nothing the TV's shape, the screen is black
- **GIVEN** the uploads `00001-a.jpg` and `00002-b.mp4`, both portrait, playing on the TV portrait
- **WHEN** the TV is turned landscape
- **THEN** the screen goes black and nothing is queued
- **AND** the box logs `Nothing in #upload is landscape. Showing black until something is, or the TV is turned back.` once
- **AND** turned back to portrait, they play again
