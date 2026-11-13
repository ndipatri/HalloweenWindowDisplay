# box-player Specification

## Purpose
Puts the right videos on the TV from the Raspberry Pi box through mpv, keeps the screen black when nothing should play, and reports what it shows, so the window runs without a computer.

## Requirements

### Requirement: Black until the clock is set
The box SHALL show black and play nothing until the system says its clock has been set from the network, and SHALL then follow the schedule.

#### Scenario: the box stays black until the clock is set
- **GIVEN** the starting filters and a `halloween` folder with videos, at 6:00 PM on Oct 20, 2026, with the clock not yet set
- **WHEN** the box runs
- **THEN** mpv plays nothing
- **AND** the status is `black (waiting for the clock to be set)`

#### Scenario: the box starts playing once the clock is set
- **GIVEN** the box waiting for the clock at 6:00 PM on Oct 20, 2026, with the starting filters and a `halloween` folder with videos
- **WHEN** the clock is set and the box runs again
- **THEN** mpv plays Halloween kid
- **AND** the status is `Halloween kid (scheduled until 7:30 PM)`

### Requirement: Recovers when mpv stops
When mpv exits, the box SHALL log it and exit with an error, so the system service starts the box again with a fresh mpv.

#### Scenario: the box exits when mpv stops, so it is restarted
- **GIVEN** the box running with mpv
- **WHEN** mpv exits with code 1
- **THEN** `ERROR: mpv stopped (exit code 1). Exiting so the box restarts.` is logged
- **AND** the box exits with code 1

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

### Requirement: Decodes HEVC videos in hardware
The box SHALL have mpv decode HEVC videos, which phones record, with the Raspberry Pi's hardware decoder, and SHALL keep every other codec, H.264 included, on software decoding without trying hardware first.

#### Scenario: the box decodes HEVC in hardware and H.264 in software
- **GIVEN** the shipped configuration
- **WHEN** the box starts mpv
- **THEN** mpv is told to use the `drm` hardware decoder for HEVC only

### Requirement: Plays the filters through mpv
While the clock is set, the box SHALL play what the filters' schedules and any override choose, as queued items in mpv, and SHALL switch as soon as that choice changes.

#### Scenario: the box plays the scheduled filter
- **GIVEN** the starting filters, a `halloween` folder with `fuzzy.mp4` and `mochi.mp4`, and the clock set
- **WHEN** the box runs at 6:00 PM on Tuesday, Oct 20, 2026
- **THEN** mpv's playlist is `halloween/fuzzy.mp4`, `halloween/mochi.mp4`, `halloween/fuzzy.mp4`, and fuzzy is playing

#### Scenario: the box switches filters when the schedule changes
- **GIVEN** the starting filters, a `halloween` folder with `fuzzy.mp4` and a `halloween/grownup` folder with `jump.mp4`, and the clock set
- **WHEN** the box runs at 7:29 PM and then at 7:30 PM on Oct 20, 2026
- **THEN** at 7:30 PM mpv's playlist is replaced with Halloween grownup's items, starting with `halloween/fuzzy.mp4` then `halloween/grownup/jump.mp4`

#### Scenario: a filter that comes back resumes at the item it was on
- **GIVEN** a `halloween` folder with `a.mp4`, `b.mp4` and `c.mp4`, and Halloween kid on `b.mp4` when an override to black starts
- **WHEN** the override ends and Halloween kid plays again
- **THEN** mpv's playlist starts with `halloween/b.mp4`

#### Scenario: an item added while playing is queued without a restart
- **GIVEN** Halloween kid playing from a `halloween` folder with only `a.mp4`
- **WHEN** `b.mp4` is added to the folder and the queue next needs topping up
- **THEN** `halloween/b.mp4` is queued after `halloween/a.mp4`

### Requirement: Keeps the next items queued
While a filter plays, mpv's playlist SHALL hold the playing item and the next two, so each follows the last without a gap, and SHALL drop items once they have played.

#### Scenario: the box keeps the next items queued
- **GIVEN** Halloween kid playing from a `halloween` folder with `a.mp4`, `b.mp4` and `c.mp4`
- **WHEN** five items in a row finish
- **THEN** after each one, mpv's playlist holds exactly three items, the first of them playing

### Requirement: Black when nothing should play, with filters
The box SHALL show black, with mpv stopped, when no filter is scheduled and while an override chooses black.

#### Scenario: the box shows black when nothing is scheduled
- **GIVEN** the starting filters, Halloween kid playing at 6:00 PM on Oct 20, 2026, and the clock set
- **WHEN** the box runs at 11:30 PM
- **THEN** mpv is stopped with an empty playlist
- **AND** the status is `black (nothing scheduled until Wed 5:00 AM)`

#### Scenario: the box shows black while an override chooses black
- **GIVEN** the starting filters, Halloween kid playing at 6:00 PM on Oct 20, 2026, and the clock set
- **WHEN** an override to black until cleared is written and the box runs again
- **THEN** mpv is stopped with an empty playlist
- **AND** the status is `black (override until cleared)`

### Requirement: Reports what it shows, naming the filter
The box SHALL write the current status line to `~/video-scheduler/status` and log it each time it changes, and SHALL log each item as it starts, naming the filter.

#### Scenario: the box writes what it is showing to the status file and the log
- **GIVEN** the starting filters and a `halloween` folder with `fuzzy.mp4`, and the clock set
- **WHEN** the box runs at 6:00 PM on Oct 20, 2026, twice
- **THEN** the status file holds `Halloween kid (scheduled until 7:30 PM)`
- **AND** the log has `Now showing: Halloween kid (scheduled until 7:30 PM)` once and `Halloween kid: playing fuzzy.mp4` once

### Requirement: Skips items mpv cannot play
When mpv fails to play an item, the box SHALL log it once and carry on with the next item.

#### Scenario: the box skips an item mpv can't play and logs it once
- **GIVEN** Halloween kid playing `halloween/bad.mp4` and then `halloween/good.mp4`
- **WHEN** mpv reports twice that `bad.mp4` failed to play
- **THEN** `ERROR: Skipping bad.mp4 in Halloween kid` is logged once
- **AND** `halloween/good.mp4` plays

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

### Requirement: Puts each picture on the TV as soon as it is drawn
The box SHALL have mpv keep at most one drawn frame waiting to be shown, so a photo (drawn only once or twice) reaches the TV as soon as mpv draws it, rather than waiting until later frames push it out.

#### Scenario: the box sends each picture to the TV as soon as it is drawn
- **GIVEN** the shipped configuration
- **WHEN** the box starts mpv
- **THEN** mpv is told to keep at most one drawn frame waiting (`--swapchain-depth=1`)

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

### Requirement: Shows its address on the TV as each item starts
When a new item starts on screen, the box SHALL show a QR code of its website's address (`http://<its IPv4 address>/`) in the corner that is bottom-right for someone looking at the TV, whichever way it faces, for `addressCode.seconds` (3 as shipped), then take it away, unless the address code is switched off or the box has no address. It SHALL draw it on top of the picture without changing it, and never while the screen is black.

#### Scenario: the address code shows for 3 seconds when an item starts
- **GIVEN** the box at 10.0.0.25 with the address code on, playing the uploads a and b
- **WHEN** a starts
- **THEN** mpv is told to draw the code of `http://10.0.0.25/` on top of the picture
- **AND** it is taken away 3 to 4 seconds later, while a is still on screen
- **AND** it is drawn again when b starts

#### Scenario: the address code sits bottom-right however the TV faces
- **GIVEN** a 1920×1080 panel and a 120-pixel code
- **WHEN** the picture is turned 0, 90, 180 or 270 degrees
- **THEN** the code is drawn 24 pixels in from the panel's bottom-right, bottom-left, top-left or top-right corner, in that order

#### Scenario: the address code is a QR code of the box's address
- **GIVEN** `qrencode`'s text output for `http://10.0.0.25/`
- **WHEN** the box makes the code
- **THEN** each dark module is black and each light one white, every module the same whole number of pixels, inside a white border two modules wide
- **AND** the whole code is at most 120 pixels square

#### Scenario: the address code follows a new address
- **GIVEN** the box showing the code of `http://10.0.0.25/`
- **WHEN** the router gives it 10.0.0.31 and the next item starts
- **THEN** the code drawn is of `http://10.0.0.31/`

#### Scenario: no address code without an address or when switched off
- **GIVEN** the box with no network address, or with the address code switched off
- **WHEN** an item starts
- **THEN** no code is drawn

#### Scenario: no address code on a black screen
- **GIVEN** the box showing the address code
- **WHEN** the screen goes black (nothing to play)
- **THEN** the code is taken away straight away

#### Scenario: setup installs qrencode for the address code
- **GIVEN** a fresh box
- **WHEN** setup runs
- **THEN** it installs `qrencode`

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
