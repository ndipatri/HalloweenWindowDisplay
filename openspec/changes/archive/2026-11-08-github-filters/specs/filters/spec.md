# Spec Delta

## MODIFIED Requirements

### Requirement: The box keeps its filters, in order
The box's filters SHALL be its custom filters, from `filters.json` in the video folder in the person's order, then its GitHub filters, from `github-filters.json` in the repo file's order, each with a name, its "any of" tags, its "except" tags and its schedule entries. A custom filter with a GitHub filter's name, ignoring case, SHALL be left out and logged once. The website SHALL list the custom and the GitHub filters apart, each in order.

#### Scenario: the website lists the filters
- **GIVEN** `filters.json` holding Late, then Party, and `github-filters.json` holding Halloween kid, then Favorites
- **WHEN** the website is asked for the filters
- **THEN** it answers with the custom filters Late, then Party, and the GitHub filters Halloween kid, then Favorites, each with its tags and schedule entries as saved

#### Scenario: custom filters come before the GitHub filters
- **GIVEN** the starting filters from GitHub, and a custom filter Party, any of `halloween`, on Oct 1–31 from 17:00 to 23:00
- **WHEN** the scheduler decides what to show at 6:00 PM on Oct 20, 2026, and the website is asked for its choices
- **THEN** Party plays, with the status `Party (scheduled until 11:00 PM)`
- **AND** the choices are Party, Halloween kid, Halloween grownup, Thanksgiving, Favorites and All uploads

#### Scenario: a custom filter named like a GitHub filter is left out and logged
- **GIVEN** the starting filters from GitHub, and `filters.json` holding a custom filter called `halloween KID`, then Party
- **WHEN** the box reads the filters twice
- **THEN** the custom filters are just Party
- **AND** `ERROR: Ignoring filter 1 (halloween KID): GitHub has a filter called Halloween kid.` is logged once

### Requirement: The website saves the filters with the PIN
With the right upload PIN, the website SHALL replace the box's custom filters with the list it is given, in order, and say so and log their names; it SHALL never change the GitHub filters. It SHALL refuse a wrong or missing PIN, and a list with any filter it can't use (a bad or repeated name, a GitHub filter's name, `black`, no "any of" tags, a bad tag name, or a bad day or time), naming the filter and the problem and saving nothing. A name is 1 to 30 letters, digits, spaces, `-` or `'`.

#### Scenario: the website saves the filters with the right PIN
- **GIVEN** the upload PIN `4321`
- **WHEN** the website is asked, with PIN `4321`, to save Christmas (any of `christmas`, Dec 1–31 from 17:00 to 23:00), then Favorites (any of `favorites`)
- **THEN** `filters.json` holds those two filters in that order
- **AND** the website answers `Saved 2 filters.`
- **AND** the log says `Filters changed (from the website): Christmas, Favorites.`

#### Scenario: the website refuses to save filters with the wrong PIN
- **GIVEN** the upload PIN `4321` and `filters.json` holding Favorites
- **WHEN** the website is asked, with PIN `1111`, to save Christmas
- **THEN** it is refused with `Wrong PIN.`
- **AND** `filters.json` still holds only Favorites

#### Scenario: the website refuses to save filters while no PIN is set
- **GIVEN** no upload PIN on the box, and `filters.json` holding Favorites
- **WHEN** the website is asked to save Christmas
- **THEN** it is refused with `Editing filters is off until a PIN is set on the box.`
- **AND** `filters.json` still holds only Favorites

#### Scenario: the website refuses a filter it can't use
- **GIVEN** the upload PIN `4321` and `filters.json` holding Favorites
- **WHEN** the website is asked, with PIN `4321`, each time to save a list with one bad filter:
  - one with no name;
  - one called `Black`;
  - two called `Kid` and `kid`;
  - one called `halloween KID` while GitHub has Halloween kid;
  - one called `Kid (old)`;
  - one with no "any of" tags;
  - one with the tag `Fav Orites`;
  - one whose entry runs from `13-01`;
  - one whose times run from `25:00`
- **THEN** each request is refused with a message naming the filter and what is wrong
- **AND** `filters.json` still holds only Favorites

### Requirement: Bad filters in the filters file are skipped
The box SHALL skip, and log once as an error naming why, any filter or schedule entry in `filters.json` or `github-filters.json` it can't use, and play the rest. Missing or unreadable files SHALL mean no filters from them; no filters at all SHALL be logged once.

#### Scenario: a bad filter in the filters file is skipped and logged
- **GIVEN** `filters.json` holding a filter with no "any of" tags, then Christmas
- **WHEN** the box reads the filters twice
- **THEN** only Christmas is kept
- **AND** `ERROR: Ignoring filter 1` is logged once, saying it has no "any of" tags

#### Scenario: no filters file means no filters
- **GIVEN** no `filters.json` and no `github-filters.json`
- **WHEN** the box reads the filters twice
- **THEN** there are no filters
- **AND** `No filters on this box yet, so nothing is scheduled. Add one on the website.` is logged once

## REMOVED Requirements

### Requirement: Setup gives a box the starting filters
**Reason**: The shared filters come from GitHub with the sync; setup copies nothing, and boxes keep only custom filters of their own.
**Migration**: See `video-sync`: "Brings the GitHub filters", and "Custom copies of GitHub filters are dropped" below.

### Requirement: The starting filters match today's window
**Reason**: The starting set is now the GitHub filters.
**Migration**: See "The GitHub filters match today's window" below.

## ADDED Requirements

### Requirement: The GitHub filters match today's window
The repo's GitHub filters (`playlists/filters.json`; "the starting filters" in other scenarios) SHALL be Halloween kid and grownup at today's days and times, Thanksgiving on its days in the evening only, then Favorites and All uploads, unscheduled. There is no Christmas filter until Christmas videos exist.

#### Scenario: the GitHub filters are today's seasons, favorites and uploads
- **GIVEN** the repo's `playlists/filters.json`
- **WHEN** the box reads them
- **THEN** all five are usable, in this order:
  - Halloween kid: any of `halloween`, `halloween-kid`; Oct 1–31, 05:00–07:00 and 17:00–19:30;
  - Halloween grownup: any of `halloween`, `halloween-grownup`; Oct 1–31, 19:30–23:00;
  - Thanksgiving: any of `thanksgiving`; Fridays and Saturdays from Nov 1 to `11-4thu`, plus `11-4thu-1` and `11-4thu`; 17:00–23:00;
  - Favorites: any of `favorites`; not scheduled;
  - All uploads: any of `upload`; not scheduled

### Requirement: Custom copies of GitHub filters are dropped
The first time the website starts with GitHub filters on the box, it SHALL drop every custom filter with a GitHub filter's name, ignoring case, from `filters.json`, and log each. It SHALL not do so again, so a custom filter that clashes later is only skipped.

#### Scenario: custom copies of the GitHub filters are dropped when the website starts
- **GIVEN** the starting filters from GitHub, and `filters.json` holding Halloween kid, Party and All uploads
- **WHEN** the website starts
- **THEN** `filters.json` holds just Party
- **AND** the log says `Dropping the custom filter Halloween kid: GitHub has a filter of that name.` and the same for All uploads
