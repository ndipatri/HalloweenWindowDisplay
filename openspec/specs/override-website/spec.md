# override-website Specification

## Purpose
Lets anyone on the home network see what the window is showing and change it for a while from a phone or laptop, replacing the Mac's `show` command.

## Requirements

### Requirement: Shows the status
The website SHALL show the box's current status line, and say when the box has not written one yet. With it, it SHALL say which season today is (none on a day no season covers, or with no seasons), so the page can tell what its Kid and Grownup buttons play today.

#### Scenario: the website shows what is on screen now
- **GIVEN** the status file holds `halloween/kid (scheduled until 7:30 PM)`
- **WHEN** the website is asked for the status
- **THEN** it answers with that status line

#### Scenario: the website says when the box has not started yet
- **GIVEN** no status file
- **WHEN** the website is asked for the status
- **THEN** it answers with no status line
- **AND** its page shows `The box has not started yet.` when there is no status line

#### Scenario: the website says which season it is today
- **GIVEN** the shipped seasons
- **WHEN** the website is asked for the status on Oct 20, 2026 at 6 PM, then on Jan 15, 2026 at 6 PM
- **THEN** it says the season is `halloween`, then that there is none

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

### Requirement: Syncs on request
The website SHALL start a sync when asked, the same sync the hourly timer runs, and SHALL answer at once. While a sync it started is still running, it SHALL not start another, and SHALL say so.

#### Scenario: the website starts a sync when asked
- **GIVEN** no sync running
- **WHEN** the website is asked to sync
- **THEN** it starts one sync
- **AND** it answers `Checking GitHub for new videos. New ones play within a minute or two; watch Recent activity below.`

#### Scenario: the website doesn't start a second sync while one is running
- **GIVEN** a sync the website started is still running
- **WHEN** the website is asked to sync again
- **THEN** it starts no other sync
- **AND** it answers `Already checking for new videos.`

### Requirement: Lists what it can show
The website SHALL list what it can show: the playlists named in the schedule, All uploads, My picks, and every season folder and season/playlist folder on the box other than `photos` and `picks`, and its page SHALL offer each of them as a Play button (the seasons in their own row), black, the durations, and back to the schedule, with no separate Preview a season section.

#### Scenario: the website lists what it can show
- **GIVEN** the shipped schedule and folders `halloween`, `halloween/grownup` and `thanksgiving`
- **WHEN** the website is asked for its choices
- **THEN** the playlists are `kid` and `grownup`
- **AND** the previews are `halloween`, `halloween/grownup` and `thanksgiving`

#### Scenario: the website page offers each choice
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a button for black and for Back to schedule, and a choice of until the schedule changes, 15, 30 or 60 minutes, or until switched back

#### Scenario: the website offers All uploads and My picks apart from the season previews
- **GIVEN** the shipped schedule and folders `halloween`, `photos`, `photos/old` and `picks`
- **WHEN** the website is asked for its choices
- **THEN** it offers All uploads and My picks
- **AND** the previews are just `halloween`

#### Scenario: the website page offers All uploads and My picks buttons
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has an All uploads button that shows `photos`, and a My picks button that shows `picks`, each for the chosen duration

#### Scenario: the page offers each season as a Play button
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** its Play section makes a button for each of the website's previews, labelled like `Halloween / Grownup`, that shows that season for the chosen duration
- **AND** it has no Preview a season section

### Requirement: The page shows what is playing under Play
The page SHALL show the status line inside the Play section, above its buttons, and SHALL outline, and mark as current, every Play button that plays what the status says is on the window: the Kid or Grownup button when today's season's playlist of that name is on (or, with no seasons, that playlist), the season button with exactly that name, My picks for `picks`, All uploads for `photos`, and Black for any black. It SHALL outline none for anything no button plays, or when the box can't be reached, and SHALL follow the status as it changes.

#### Scenario: the page shows the status under Play and outlines what is playing
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** the status line is inside the Play section, before its buttons, with no separate status card above it
- **AND** the button for what is playing is outlined and has `aria-current="true"`, and the outline is updated with the status

#### Scenario: the page works out which Play button is playing from the status
- **GIVEN** the page, the playlists `kid` and `grownup`, the season buttons `halloween`, `halloween/grownup` and `thanksgiving`, and today's season
- **WHEN** the status, with today's season, is:
  - `thanksgiving/kid (scheduled until 7:30 PM)` on a Thanksgiving day;
  - `halloween/grownup (override until cleared)` on a Thanksgiving day;
  - `halloween/grownup (scheduled until 11:00 PM)` on a Halloween day;
  - `kid (scheduled until 7:00 AM)` with no seasons;
  - `halloween/kid (override until cleared)` on a day no season covers;
  - `picks (override until cleared)`, then `photos (override until 8:15 PM, then back to the schedule)`;
  - `black (outside schedule until 5:00 PM)`, `black (no season today, Nov 2)`, `black (waiting for the clock to be set)`, and `black (override until cleared; asked for kid but no season today)`;
  - `halloween/scary (override until cleared)` on a Halloween day;
  - `thanksgiving (override until cleared)` on a Thanksgiving day;
  - and no status
- **THEN** the buttons playing are, in that order:
  - Kid;
  - Halloween / Grownup only;
  - Grownup and Halloween / Grownup;
  - Kid;
  - none;
  - My picks, then All uploads;
  - Black each time;
  - none;
  - Thanksgiving;
  - and none

### Requirement: The page starts on until switched back
The page's For how long choice SHALL start on Until switched back each time the page is opened, with the other durations still offered. A request to show something that gives no duration SHALL still last until the schedule changes.

#### Scenario: the page starts For how long on until switched back
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** For how long has Until switched back chosen, and only that option chosen

### Requirement: Shows recent activity and offers new videos
The website SHALL show the last 20 lines of the box's log, oldest first, and no lines when there is no log yet. Its page SHALL offer to check for new videos now, in a section saying what that does, and show the recent activity, refreshed every few seconds.

#### Scenario: the website shows the last lines of the log
- **GIVEN** the log has 30 lines, `line 1` to `line 30`
- **WHEN** the website is asked for the recent activity
- **THEN** it answers with `line 11` to `line 30`, in that order

#### Scenario: the website shows no log lines when there is no log yet
- **GIVEN** no log file
- **WHEN** the website is asked for the recent activity
- **THEN** it answers with no lines

#### Scenario: the website page offers checking for new videos and shows recent activity
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a New videos from GitHub section saying `The box checks GitHub for new videos every hour by itself.`, with a Check for new videos now button that starts a sync and shows the website's answer just under it
- **AND** it has a Recent activity list filled from the website's recent activity
