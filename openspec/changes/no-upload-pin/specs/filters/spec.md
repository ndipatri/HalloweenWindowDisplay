## REMOVED Requirements

### Requirement: The website saves the filters with the PIN
**Reason**: The upload PIN is gone; saving filters needs no PIN.
**Migration**: Replaced by "The website saves the filters".

## ADDED Requirements

### Requirement: The website saves the filters
Asked by anyone on the home network, with no PIN, the website SHALL replace the box\'s custom filters with the list it is given, in order, say so, log their names, and never change the GitHub filters. It SHALL refuse a list with any filter it can\'t use (a name that isn\'t 1 to 30 letters, digits, spaces, `-` or `\'`, or is repeated, a GitHub filter\'s or `black`; no "any of" tags; a bad tag; no days and times; a bad day or time), naming the filter and the problem and saving nothing.

#### Scenario: the website saves the filters with no PIN
- **GIVEN** the website running
- **WHEN** the website is asked to save Christmas (any of `christmas`, Dec 1–31 from 17:00 to 23:00), then Late (any of `halloween`, Fridays from Jan 1 to Dec 31, 22:00 to 01:00)
- **THEN** `filters.json` holds those two filters in that order
- **AND** the website answers `Saved 2 filters.`
- **AND** the log says `Filters changed (from the website): Christmas, Late.`

#### Scenario: the website refuses a filter it can't use
- **GIVEN** `filters.json` holding Late
- **WHEN** the website is asked, each time to save a list with one bad filter:
  - one with no name;
  - one called `Black`;
  - two called `Kid` and `kid`;
  - one called `halloween KID` while GitHub has Halloween kid;
  - one called `Kid (old)`;
  - one with no "any of" tags;
  - one with no days and times;
  - one with the tag `Fav Orites`;
  - one whose entry runs from `13-01`;
  - one whose times run from `25:00`
- **THEN** each request is refused with a message naming the filter and what is wrong
- **AND** `filters.json` still holds only Late

## MODIFIED Requirements

### Requirement: A filter needs days and times
A filter SHALL have at least one schedule entry with days. The website SHALL refuse one without (`<name>: a filter needs days and times; to play tags any time, pick them under Play.`), and the box SHALL skip one in a file, logged once.

#### Scenario: a filter without days and times is refused and skipped
- **GIVEN** `filters.json` holding Favorites (any of `favorites`, no schedule), then Late
- **WHEN** the box reads the filters, and the website is asked to save Party (any of `halloween`, no schedule)
- **THEN** only Late is kept, and `ERROR: Ignoring filter 1 (Favorites): a filter needs days and times` is logged
- **AND** the save is refused with `Party: a filter needs days and times; to play tags any time, pick them under Play.`

#### Scenario: a custom filter without days and times is dropped when the website starts
- **GIVEN** the box's own filters are Favorites (any of `favorites`, no schedule), then Party (any of `halloween`, in December), saved before filters needed days and times
- **WHEN** the website starts
- **THEN** the box's own filters are just Party
- **AND** `Dropping the custom filter Favorites: a filter needs days and times now; pick its tags under Play instead.` is logged
