# Spec Delta

## MODIFIED Requirements

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
