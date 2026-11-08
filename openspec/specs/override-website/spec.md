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

### Requirement: Shows a filter for a while
The website SHALL write an override for one of the box's filters, or black, lasting until the schedule changes, for a number of minutes, or until switched back, and SHALL say in plain words what it did.

#### Scenario: the website shows a filter until the schedule changes
- **GIVEN** the starting filters, at 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show Halloween grownup until the schedule changes
- **THEN** the override file asks for Halloween grownup, set at 6:00 PM, with no end time and not until cleared
- **AND** the website answers `Showing Halloween grownup until the schedule next changes.`

#### Scenario: the website shows a filter for a number of minutes
- **GIVEN** the starting filters, at 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show Favorites for 30 minutes
- **THEN** the override file asks for Favorites ending at 6:30 PM
- **AND** the website answers `Showing Favorites until 6:30 PM, then back to the schedule.`

#### Scenario: the website shows a filter until switched back
- **GIVEN** the starting filters, at 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show Thanksgiving until switched back
- **THEN** the override file asks for Thanksgiving until cleared
- **AND** the website answers `Showing Thanksgiving until you choose Back to schedule.`

#### Scenario: the website turns the screen black
- **GIVEN** it is 6:00 PM on Oct 20, 2026
- **WHEN** the website is asked to show black until the schedule changes
- **THEN** the override file asks for no filter
- **AND** the website answers `Showing black until the schedule next changes.`

### Requirement: Refuses bad choices of filter
The website SHALL refuse, without writing an override, a filter the box doesn't have, a filter with nothing in it, and a number of minutes that is not a whole number above zero.

#### Scenario: the website refuses a filter it doesn't have
- **GIVEN** the starting filters and no override file
- **WHEN** the website is asked to show Easter, then `../x`
- **THEN** each request is refused with `No filter called` and the name
- **AND** no override file is written

#### Scenario: the website refuses a filter with nothing in it
- **GIVEN** the starting filters, no item tagged `favorites`, and no override file
- **WHEN** the website is asked to show Favorites
- **THEN** it is refused with `Nothing in Favorites yet. Tag something favorites first.` (for a filter with several "any of" tags: `Tag something` followed by them joined with `or`)
- **AND** no override file is written

#### Scenario: the website refuses minutes that aren't a whole number above zero
- **GIVEN** the starting filters and no override file
- **WHEN** the website is asked to show Halloween kid for 0, then -5, then 2.5, then `soon` minutes
- **THEN** each request is refused with `Not a number of minutes`
- **AND** no override file is written

### Requirement: Offers the filters as Play buttons
The website SHALL list the box's filters, in order, as its choices, and its page SHALL offer a Play button for each, Black, the durations, and Back to schedule.

#### Scenario: the website lists its filters as choices
- **GIVEN** the starting filters
- **WHEN** the website is asked for its choices
- **THEN** the filters are Halloween kid, Halloween grownup, Thanksgiving, Favorites and All uploads, in that order

#### Scenario: the website page offers each choice
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a button for black and for Back to schedule, and a choice of until the schedule changes, 15, 30 or 60 minutes, or until switched back

#### Scenario: the page offers each filter as a Play button
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** its Play section makes a button for each of the website's filters, in order and named as the filter, that shows that filter for the chosen duration
- **AND** it has no Seasons row, Kid, Grownup, My picks or All uploads buttons of its own, and no My picks section

### Requirement: The page outlines the playing filter
The page SHALL show the status line inside the Play section, above its buttons, and SHALL outline, and mark as current, the button of the filter the status names, or Black when the status is black, and none otherwise or when the box can't be reached, following the status as it changes.

#### Scenario: the page shows the status under Play and outlines what is playing
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** the status line is inside the Play section, before its buttons, with no separate status card above it
- **AND** the button for what is playing is outlined and has `aria-current="true"`, and the outline is updated with the status

#### Scenario: the page works out which filter is playing from the status
- **GIVEN** the page, and the filters Halloween kid and Favorites
- **WHEN** the status is `Halloween kid (scheduled until 7:30 PM)`, `Favorites (override until cleared)`, `black (nothing scheduled until 5:00 PM)`, `black (waiting for the clock to be set)`, `Easter (override until cleared)`, and no status
- **THEN** the button playing is Halloween kid, Favorites, Black, Black, none, and none

### Requirement: The page tags items
The page SHALL offer a Tags section listing every item from the website's list under its group, each with its folder tags (which can't be taken off), its box tags (each with a way to take it off), a star that adds or takes off `favorites`, and a way to add a tag, suggesting the tags in use. Each change SHALL be saved straight away and confirmed next to the item.

#### Scenario: the website page offers tagging items
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a Tags section filled from the website's items, with folder tags, box tags with a way to take each off, a favorites star, and an add-a-tag field suggesting the tags in use, each change posted to the website straight away

### Requirement: The page edits filters
The page SHALL offer a Filters section listing the box's filters in order, with ways to move each up or down, edit, delete and add one. Editing SHALL cover the name, "any of" and "except" tags chosen from the tags in use, and schedule entries (first and last day, weekdays, extra days, and times). Saving SHALL send the whole list with the upload PIN, and show the website's answer there.

#### Scenario: the website page offers editing filters with the PIN
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a Filters section filled from the website's filters, with up, down, edit, delete and new filter, an editor for the name, tags and schedule entries, and a save that sends the list with the PIN and shows the answer in the section

#### Scenario: the page moves a filter up and down
- **GIVEN** the page with the filters Halloween kid, Christmas and Favorites
- **WHEN** the person moves Favorites up, then Halloween kid down
- **THEN** the list is first Halloween kid, Favorites, Christmas, then Favorites, Halloween kid, Christmas
