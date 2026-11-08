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
