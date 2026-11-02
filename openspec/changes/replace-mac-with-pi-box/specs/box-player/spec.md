## Purpose

Puts the right videos on the TV from the Raspberry Pi box through mpv, keeps the screen black when nothing should play, and reports what it shows, so the window runs without a computer.

## ADDED Requirements

### Requirement: Plays the schedule through mpv
While the clock is set, the box SHALL play what the schedule and any override choose, as queued videos in mpv, and SHALL switch as soon as that choice changes.

#### Scenario: the box plays today's season playlist on schedule
- **GIVEN** the shipped schedule and seasons, a `halloween` folder with `fuzzy.mp4` and `mochi.mp4`, and the clock set
- **WHEN** the box runs at 6:00 PM on Tuesday, Oct 20, 2026
- **THEN** mpv's playlist is `halloween/fuzzy.mp4`, `halloween/mochi.mp4`, `halloween/fuzzy.mp4`, and fuzzy is playing

#### Scenario: the box switches playlists when the schedule changes
- **GIVEN** the shipped schedule and seasons, a `halloween` folder with `fuzzy.mp4` and a `halloween/grownup` folder with `jump.mp4`, and the clock set
- **WHEN** the box runs at 7:29 PM and then at 7:30 PM on Oct 20, 2026
- **THEN** at 7:30 PM mpv's playlist is replaced with the grownup playlist's videos, starting with `halloween/fuzzy.mp4` then `halloween/grownup/jump.mp4`

#### Scenario: a playlist that comes back resumes at the video it was on
- **GIVEN** a `halloween` folder with `a.mp4`, `b.mp4` and `c.mp4`, and the kid playlist on `b.mp4` when an override to black starts
- **WHEN** the override ends and the kid playlist plays again
- **THEN** mpv's playlist starts with `halloween/b.mp4`

#### Scenario: a video added while playing is queued without a restart
- **GIVEN** the kid playlist playing from a `halloween` folder with only `a.mp4`
- **WHEN** `b.mp4` is added to the folder and the queue next needs topping up
- **THEN** `halloween/b.mp4` is queued after `halloween/a.mp4`

### Requirement: Black when nothing should play
The box SHALL show black, with mpv stopped, outside the schedule, on a day with no season, and while an override chooses black.

#### Scenario: the box shows black outside the schedule
- **GIVEN** the shipped schedule and seasons, kid playing at 6:00 PM on Oct 20, 2026, and the clock set
- **WHEN** the box runs at 11:30 PM
- **THEN** mpv is stopped with an empty playlist
- **AND** the status is `black (outside schedule until Wed 5:00 AM)`

### Requirement: Black until the clock is set
The box SHALL show black and play nothing until the system says its clock has been set from the network, and SHALL then follow the schedule.

#### Scenario: the box stays black until the clock is set
- **GIVEN** the shipped schedule and seasons and a `halloween` folder with videos, at 6:00 PM on Oct 20, 2026, with the clock not yet set
- **WHEN** the box runs
- **THEN** mpv plays nothing
- **AND** the status is `black (waiting for the clock to be set)`

#### Scenario: the box starts playing once the clock is set
- **GIVEN** the box waiting for the clock at 6:00 PM on Oct 20, 2026, with a `halloween` folder with videos
- **WHEN** the clock is set and the box runs again
- **THEN** mpv plays the halloween kid playlist
- **AND** the status is `halloween/kid (scheduled until 7:30 PM)`

### Requirement: Reports what it shows
The box SHALL write the current status line to `~/video-scheduler/status` and log it each time it changes, and SHALL log each video as it starts.

#### Scenario: the box writes what it is showing to the status file and the log
- **GIVEN** the shipped schedule and seasons and a `halloween` folder with `fuzzy.mp4`, and the clock set
- **WHEN** the box runs at 6:00 PM on Oct 20, 2026, twice
- **THEN** the status file holds `halloween/kid (scheduled until 7:30 PM)`
- **AND** the log has `Now showing: halloween/kid (scheduled until 7:30 PM)` once and `halloween/kid: playing fuzzy.mp4` once

### Requirement: Skips videos mpv cannot play
When mpv fails to play a video, the box SHALL log it once and carry on with the next video.

#### Scenario: the box skips a video mpv can't play and logs it once
- **GIVEN** the kid playlist playing `halloween/bad.mp4` and then `halloween/good.mp4`
- **WHEN** mpv reports twice that `bad.mp4` failed to play
- **THEN** `ERROR: Skipping bad.mp4 in halloween/kid` is logged once
- **AND** `halloween/good.mp4` plays

### Requirement: Recovers when mpv stops
When mpv exits, the box SHALL log it and exit with an error, so the system service starts the box again with a fresh mpv.

#### Scenario: the box exits when mpv stops, so it is restarted
- **GIVEN** the box running with mpv
- **WHEN** mpv exits with code 1
- **THEN** `ERROR: mpv stopped (exit code 1). Exiting so the box restarts.` is logged
- **AND** the box exits with code 1
