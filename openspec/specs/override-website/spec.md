# override-website Specification

## Purpose
Lets anyone on the home network see what the window is showing and change it for a while from a phone or laptop, replacing the Mac's `show` command.

## Requirements

### Requirement: Back to the schedule
The website SHALL remove the override when asked to go back to the schedule.

#### Scenario: the website goes back to the schedule
- **GIVEN** an override file asking for Favorites
- **WHEN** the website is asked to go back to the schedule
- **THEN** the override file is gone
- **AND** the website answers `Override cancelled. Following the schedule.`

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

### Requirement: Shows what is on screen
The website SHALL show the box's current status line, and say when the box has not written one yet.

#### Scenario: the website shows what is on screen now
- **GIVEN** the status file holds `Halloween kid (scheduled until 7:30 PM)`
- **WHEN** the website is asked for the status
- **THEN** it answers with that status line

#### Scenario: the website says when the box has not started yet
- **GIVEN** no status file
- **WHEN** the website is asked for the status
- **THEN** it answers with no status line
- **AND** its page shows `The box has not started yet.` when there is no status line

### Requirement: The page tags items
The page SHALL offer a Tags section listing every upload from the website's list, each with its box tags (each with a way to take it off), a star that adds or takes off `favorites`, and a way to add a tag, suggesting the tags in use, and SHALL say that videos from GitHub take their tags from their folders. Each change SHALL be saved straight away and confirmed next to the upload.

#### Scenario: the website page offers tagging items
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a Tags section filled from the website's items (the uploads), saying videos from GitHub take their tags from their folders, with box tags with a way to take each off, a favorites star, and an add-a-tag field suggesting the tags in use, each change posted to the website straight away

### Requirement: The page edits filters
The page SHALL offer a Filters section listing the box's custom filters in order, with ways to move each up or down, edit, delete and add one, and, apart from them, the GitHub filters in order with their tags and schedules but no way to change them, saying they come from GitHub. Editing SHALL cover the name, "any of" and "except" tags chosen from the tags in use, and schedule entries (first and last day, weekdays, extra days, and times). Saving SHALL send the custom filters with the upload PIN, and show the website's answer there.

#### Scenario: the website page offers editing filters with the PIN
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a Filters section filled from the website's filters: the custom ones with up, down, edit and delete, and new filter, an editor for the name, tags and schedule entries, and a save that sends the custom filters with the PIN and shows the answer in the section
- **AND** a read-only list of the GitHub filters, saying they come from GitHub and are changed there

#### Scenario: the page moves a filter up and down
- **GIVEN** the page with the filters Halloween kid, Christmas and Favorites
- **WHEN** the person moves Favorites up, then Halloween kid down
- **THEN** the list is first Halloween kid, Favorites, Christmas, then Favorites, Halloween kid, Christmas

### Requirement: Shows tags for a while
The website SHALL write an override for one or more tags in use and filters the box has, or black, lasting until the schedule changes, for a number of minutes, or until switched back, and SHALL say in plain words what it did, naming the tags with `#`, then the filters.

#### Scenario: the website shows tags until the schedule changes
- **GIVEN** `halloween/grownup/jump.mp4`, at 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show the tag `halloween-grownup` until the schedule changes
- **THEN** the override file asks for the tags `halloween-grownup`, set at 6:00 PM, with no end time and not until cleared
- **AND** the website answers `Showing #halloween-grownup until the schedule next changes.`

#### Scenario: the website shows tags for a number of minutes
- **GIVEN** `photos/00001-a.jpg` tagged `favorites`, at 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show the tag `favorites` for 30 minutes
- **THEN** the override file asks for `favorites` ending at 6:30 PM
- **AND** the website answers `Showing #favorites until 6:30 PM, then back to the schedule.`

#### Scenario: the website shows several tags until switched back
- **GIVEN** `halloween/fuzzy.mp4` and `thanksgiving/dusk.mp4`, at 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show the tags `halloween` and `thanksgiving` until switched back
- **THEN** the override file asks for `halloween` and `thanksgiving` until cleared
- **AND** the website answers `Showing #halloween + #thanksgiving until you choose Back to schedule.`

#### Scenario: the website turns the screen black
- **GIVEN** it is 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show black until the schedule changes
- **THEN** the override file asks for no tags
- **AND** the website answers `Showing black until the schedule next changes.`

#### Scenario: the website shows a tag and a filter together
- **GIVEN** the starting filters, and `photos/00001-a.jpg` tagged `favorites`, at 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show the tag `favorites` and the filter Halloween kid until switched back
- **THEN** the override file asks for the tag `favorites` and the filter Halloween kid until cleared
- **AND** the website answers `Showing #favorites + Halloween kid until you choose Back to schedule.`

### Requirement: Refuses bad choices of tags
The website SHALL refuse, without writing an override, a tag no item has, a filter the box doesn't have, nothing picked at all, and a number of minutes that is not a whole number above zero.

#### Scenario: the website refuses a tag no item has
- **GIVEN** `halloween/fuzzy.mp4` and no override file
- **WHEN** the website is asked to show the tags `halloween` and `easter`, then `../x`
- **THEN** each request is refused with `No tag called` and the tag
- **AND** no override file is written

#### Scenario: the website refuses a filter it doesn't have
- **GIVEN** the starting filters and no override file
- **WHEN** the website is asked to show the filter Easter
- **THEN** it is refused with `No filter called Easter on the box.`
- **AND** no override file is written

#### Scenario: the website refuses to show no tags
- **GIVEN** no override file
- **WHEN** the website is asked to show no tags and no filters
- **THEN** it is refused with `Pick one or more tags or filters to play.`
- **AND** no override file is written

#### Scenario: the website refuses minutes that aren't a whole number above zero
- **GIVEN** `halloween/fuzzy.mp4` and no override file
- **WHEN** the website is asked to show the tag `halloween` for 0, then -5, then 2.5, then `soon` minutes
- **THEN** each request is refused with `Not a number of minutes`
- **AND** no override file is written

### Requirement: Offers the tags under Play
The website SHALL list every tag in use, in name order, and every filter, custom then GitHub, as its choices, and its page SHALL offer each as a button that selects it, several at a time (tags in one row, filters in another), a Play button that shows what is selected for the chosen duration, Black, the durations, and Back to schedule.

#### Scenario: the website lists the tags as choices
- **GIVEN** `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4`, `thanksgiving/dusk.mp4`, and `photos/00001-a.jpg` tagged `favorites`
- **WHEN** the website is asked for its choices
- **THEN** the tags are `favorites`, `halloween`, `halloween-grownup`, `thanksgiving` and `upload`
- **AND** the filters are Halloween kid, Halloween grownup and Thanksgiving

#### Scenario: the website page offers each choice
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a button for black and for Back to schedule, and a choice of until the schedule changes, 15, 30 or 60 minutes, or until switched back

#### Scenario: the page offers each tag under Play, to pick several and play
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** its Play section makes a button for each of the website's tags, labelled as words, and one for each of its filters, in a row of their own, each selecting or unselecting it without showing anything
- **AND** a Play button shows what is selected for the chosen duration, and is off while nothing is selected

#### Scenario: the page labels tags as words
- **GIVEN** the page
- **WHEN** it labels the tags `halloween-grownup`, `favorites` and `upload`
- **THEN** they read `Halloween grownup`, `Favorites` and `Uploads`

### Requirement: The page highlights the playing tags
The page SHALL show the status line inside the Play section, above its buttons, and SHALL outline, and mark as current, the buttons of the tags and filters the status names (picked under Play, or a filter playing on its schedule), or Black when it is black, and none otherwise or when the box can't be reached, following the status as it changes.

#### Scenario: the page shows the status under Play and outlines what is playing
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** the status line is inside the Play section, before its buttons, with no separate status card above it
- **AND** the buttons for what is playing are outlined and have `aria-current="true"`, and the outline is updated with the status

#### Scenario: the page works out which tags are playing from the status
- **GIVEN** the page, and the filters Halloween kid and Thanksgiving
- **WHEN** the status is `#halloween + #thanksgiving (override until cleared)`, `#favorites + Halloween kid (override until 6:30 PM)`, `Thanksgiving (scheduled until 11:00 PM)`, `black (nothing scheduled)`, `black (waiting for the clock to be set)`, and no status
- **THEN** the playing choices are the tags `halloween` and `thanksgiving`; the tag `favorites` and the filter Halloween kid; the filter Thanksgiving; black; black; and none
