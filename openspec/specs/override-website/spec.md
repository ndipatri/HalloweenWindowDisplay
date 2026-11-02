# override-website Specification

## Purpose
Lets anyone on the home network see what the window is showing and change it for a while from a phone or laptop, replacing the Mac's `show` command.

## Requirements

### Requirement: Shows the status
The website SHALL show the box's current status line, and say when the box has not written one yet.

#### Scenario: the website shows what is on screen now
- **GIVEN** the status file holds `halloween/kid (scheduled until 7:30 PM)`
- **WHEN** the website is asked for the status
- **THEN** it answers with that status line

#### Scenario: the website says when the box has not started yet
- **GIVEN** no status file
- **WHEN** the website is asked for the status
- **THEN** it answers with no status line
- **AND** its page shows `The box has not started yet.` when there is no status line

### Requirement: Overrides for a while
The website SHALL write an override in the same format the box reads, for a playlist name, a season, a season/playlist, or black, lasting until the schedule changes, for a number of minutes, or until switched back, and SHALL say in plain words what it did.

#### Scenario: the website plays a playlist until the schedule changes
- **GIVEN** it is 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show `grownup` until the schedule changes
- **THEN** the override file asks for `grownup`, set at 6:00 PM, with no end time and not until cleared
- **AND** the website answers `Showing grownup until the schedule next changes.`

#### Scenario: the website plays a playlist for a number of minutes
- **GIVEN** it is 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show `kid` for 30 minutes
- **THEN** the override file asks for `kid` ending at 6:30 PM
- **AND** the website answers `Showing kid until 6:30 PM, then back to the schedule.`

#### Scenario: the website plays a playlist until switched back
- **GIVEN** it is 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show `grownup` until switched back
- **THEN** the override file asks for `grownup` until cleared
- **AND** the website answers `Showing grownup until you choose Back to schedule.`

#### Scenario: the website turns the screen black
- **GIVEN** it is 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show black until the schedule changes
- **THEN** the override file asks for no playlist
- **AND** the website answers `Showing black until the schedule next changes.`

#### Scenario: the website previews another season
- **GIVEN** a `christmas` folder with a `kid` subfolder
- **WHEN** the website is asked to show `christmas/kid` for 5 minutes
- **THEN** the override file asks for `christmas/kid`

### Requirement: Back to the schedule
The website SHALL remove the override when asked to go back to the schedule.

#### Scenario: the website goes back to the schedule
- **GIVEN** an override file asking for `grownup`
- **WHEN** the website is asked to go back to the schedule
- **THEN** the override file is gone
- **AND** the website answers `Override cancelled. Following the schedule.`

### Requirement: Refuses bad choices
The website SHALL refuse, without writing an override, a name that is not a playlist name, a season or season/playlist whose season folder does not exist, and a number of minutes that is not a whole number above zero.

#### Scenario: the website refuses a name that isn't a playlist
- **GIVEN** no override file
- **WHEN** the website is asked to show `../x`, then `a/b/c`, then `.hidden`
- **THEN** each request is refused with `Not a playlist name`
- **AND** no override file is written

#### Scenario: the website refuses a season that has no folder
- **GIVEN** no `easter` folder
- **WHEN** the website is asked to show `easter/kid`
- **THEN** the request is refused with `No easter folder on the box`
- **AND** no override file is written

#### Scenario: the website refuses minutes that aren't a whole number above zero
- **GIVEN** no override file
- **WHEN** the website is asked to show `kid` for 0, then -5, then 2.5, then `soon` minutes
- **THEN** each request is refused with `Not a number of minutes`
- **AND** no override file is written

### Requirement: Lists the choices
The website SHALL list what it can show: the playlists named in the schedule, and every season folder and season/playlist folder on the box, and its page SHALL offer each of them, black, the durations, and back to the schedule.

#### Scenario: the website lists what it can show
- **GIVEN** the shipped schedule and folders `halloween`, `halloween/grownup` and `thanksgiving`
- **WHEN** the website is asked for its choices
- **THEN** the playlists are `kid` and `grownup`
- **AND** the previews are `halloween`, `halloween/grownup` and `thanksgiving`

#### Scenario: the website page offers each choice
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a button for black and for Back to schedule, and a choice of until the schedule changes, 15, 30 or 60 minutes, or until switched back

### Requirement: Syncs on request
The website SHALL start a sync when asked, the same sync the hourly timer runs, and SHALL answer at once. While a sync it started is still running, it SHALL not start another, and SHALL say so.

#### Scenario: the website starts a sync when asked
- **GIVEN** no sync running
- **WHEN** the website is asked to sync
- **THEN** it starts one sync
- **AND** it answers `Syncing now. New videos play within a minute or two.`

#### Scenario: the website doesn't start a second sync while one is running
- **GIVEN** a sync the website started is still running
- **WHEN** the website is asked to sync again
- **THEN** it starts no other sync
- **AND** it answers `A sync is already running.`

### Requirement: Shows recent activity
The website SHALL show the last 20 lines of the box's log, oldest first, and no lines when there is no log yet. Its page SHALL offer Sync now and show the recent activity, refreshed every few seconds.

#### Scenario: the website shows the last lines of the log
- **GIVEN** the log has 30 lines, `line 1` to `line 30`
- **WHEN** the website is asked for the recent activity
- **THEN** it answers with `line 11` to `line 30`, in that order

#### Scenario: the website shows no log lines when there is no log yet
- **GIVEN** no log file
- **WHEN** the website is asked for the recent activity
- **THEN** it answers with no lines

#### Scenario: the website page offers Sync now and shows recent activity
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a Sync now button and a Recent activity list filled from the website's recent activity
