# Spec Delta

## REMOVED Requirements

### Requirement: Shows a filter for a while
**Reason**: The Play section plays tags and filters, picked several at a time and played together.
**Migration**: See "Shows tags for a while".

### Requirement: Refuses bad choices of filter
**Reason**: The Play section plays tags and filters, picked several at a time and played together.
**Migration**: See "Refuses bad choices of tags".

### Requirement: Offers the filters as Play buttons
**Reason**: The Play section plays tags and filters, picked several at a time and played together.
**Migration**: See "Offers the tags under Play".

### Requirement: The page outlines the playing filter
**Reason**: The Play section plays tags and filters, picked several at a time and played together.
**Migration**: See "The page highlights the playing tags".

## ADDED Requirements

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
