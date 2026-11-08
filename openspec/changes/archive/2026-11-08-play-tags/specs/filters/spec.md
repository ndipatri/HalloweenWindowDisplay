# Spec Delta

## MODIFIED Requirements

### Requirement: Tags or filters changing while a filter plays
When tags or the filters are saved while a filter or chosen tags play, the box SHALL replace what is queued behind the item on screen with that filter's items as they now are, continuing after that item. If the item on screen no longer belongs, the box SHALL move on at once, without going black, to the next item after it in name order, or else the first, logging no error.

#### Scenario: tagging an item while its filter plays queues it in its place
- **GIVEN** the tag `favorites` playing `photos/00001-a.jpg`, with `photos/00003-c.jpg` queued, all tagged `favorites`
- **WHEN** `photos/00002-b.jpg` is tagged `favorites`
- **THEN** mpv's playlist is `photos/00001-a.jpg`, playing, then `photos/00002-b.jpg`, `photos/00003-c.jpg`

#### Scenario: untagging the item on screen moves on to the next item
- **GIVEN** the tag `favorites` playing `photos/00001-a.jpg`, with `photos/00002-b.jpg` and `photos/00003-c.jpg` queued, all tagged `favorites`
- **WHEN** `favorites` is taken off `photos/00001-a.jpg`
- **THEN** mpv's playlist is `photos/00002-b.jpg`, playing, then `photos/00003-c.jpg`, `photos/00002-b.jpg`
- **AND** no `ERROR:` line is logged

### Requirement: A removed upload leaves the screen cleanly
When an upload is removed through the website while it is showing, the box SHALL take it out of mpv's playlist before the file is deleted, moving on to the next item if it was showing, and SHALL log no error for it.

#### Scenario: removing the upload on screen moves on to the next
- **GIVEN** the tag `upload` playing `00001-a.jpg`, with `00002-b.mp4` and `00003-c.png` queued
- **WHEN** `00001-a.jpg` is removed through the website
- **THEN** mpv's playlist starts with `photos/00002-b.mp4`, playing, and no longer holds `00001-a.jpg`
- **AND** no `ERROR:` line is logged

#### Scenario: removing a queued upload takes it out of the queue
- **GIVEN** the tag `upload` playing `00001-a.jpg`, with `00002-b.mp4` and `00003-c.png` queued
- **WHEN** `00002-b.mp4` is removed through the website
- **THEN** `photos/00001-a.jpg` is still playing, and mpv's playlist no longer holds `00002-b.mp4`
- **AND** no `ERROR:` line is logged

### Requirement: The box keeps its filters, in order
The box's filters SHALL be its custom filters, from `filters.json` in the video folder in the person's order, then its GitHub filters, from `github-filters.json` in the repo file's order, each with a name, its "any of" tags, its "except" tags and its schedule entries. A custom filter with a GitHub filter's name, ignoring case, SHALL be left out and logged once. The website SHALL list the custom and the GitHub filters apart, each in order.

#### Scenario: the website lists the filters
- **GIVEN** `filters.json` holding Late, then Party, and `github-filters.json` holding Halloween kid, then Thanksgiving
- **WHEN** the website is asked for the filters
- **THEN** it answers with the custom filters Late, then Party, and the GitHub filters Halloween kid, then Thanksgiving, each with its tags and schedule entries as saved

#### Scenario: custom filters come before the GitHub filters
- **GIVEN** the starting filters from GitHub, and a custom filter Party, any of `halloween`, on Oct 1–31 from 17:00 to 23:00
- **WHEN** the scheduler decides what to show at 6:00 PM on Oct 20, 2026
- **THEN** Party plays, with the status `Party (scheduled until 11:00 PM)`
- **AND** the box's filters are, in order, Party, Halloween kid, Halloween grownup and Thanksgiving

#### Scenario: a custom filter named like a GitHub filter is left out and logged
- **GIVEN** the starting filters from GitHub, and `filters.json` holding a custom filter called `halloween KID` (any of `x`, Jan 1–Dec 31), then Party
- **WHEN** the box reads the filters twice
- **THEN** the custom filters are just Party
- **AND** `ERROR: Ignoring filter 1 (halloween KID): GitHub has a filter called Halloween kid.` is logged once

### Requirement: The website saves the filters with the PIN
With the right upload PIN, the website SHALL replace the box's custom filters with the list it is given, in order, and say so and log their names; it SHALL never change the GitHub filters. It SHALL refuse a wrong or missing PIN, and a list with any filter it can't use (a bad or repeated name, a GitHub filter's name, `black`, no "any of" tags, a bad tag name, no days and times, or a bad day or time), naming the filter and the problem and saving nothing. A name is 1 to 30 letters, digits, spaces, `-` or `'`.

#### Scenario: the website saves the filters with the right PIN
- **GIVEN** the upload PIN `4321`
- **WHEN** the website is asked, with PIN `4321`, to save Christmas (any of `christmas`, Dec 1–31 from 17:00 to 23:00), then Late (any of `halloween`, Fridays from Jan 1 to Dec 31, 22:00 to 01:00)
- **THEN** `filters.json` holds those two filters in that order
- **AND** the website answers `Saved 2 filters.`
- **AND** the log says `Filters changed (from the website): Christmas, Late.`

#### Scenario: the website refuses to save filters with the wrong PIN
- **GIVEN** the upload PIN `4321` and `filters.json` holding Late
- **WHEN** the website is asked, with PIN `1111`, to save Christmas
- **THEN** it is refused with `Wrong PIN.`
- **AND** `filters.json` still holds only Late

#### Scenario: the website refuses to save filters while no PIN is set
- **GIVEN** no upload PIN on the box, and `filters.json` holding Late
- **WHEN** the website is asked to save Christmas
- **THEN** it is refused with `Editing filters is off until a PIN is set on the box.`
- **AND** `filters.json` still holds only Late

#### Scenario: the website refuses a filter it can't use
- **GIVEN** the upload PIN `4321` and `filters.json` holding Late
- **WHEN** the website is asked, with PIN `4321`, each time to save a list with one bad filter:
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

### Requirement: A filter shows what has any of its tags, except its except tags
A filter SHALL show every item that has at least one of its "any of" tags and none of its "except" tags, counting folder tags, `upload` and uploads' box tags alike.

#### Scenario: a filter plays the items with any of its tags
- **GIVEN** `halloween/fuzzy.mp4`, `halloween/kid/x.mp4`, `halloween/grownup/y.mp4` and `thanksgiving/dusk.mp4`
- **AND** the filter Halloween kid, any of `halloween` and `halloween-kid`
- **WHEN** Halloween kid plays four items
- **THEN** they are `halloween/fuzzy.mp4`, `halloween/kid/x.mp4`, then the same two again

#### Scenario: a filter leaves out items with an except tag
- **GIVEN** `christmas/tree.mp4`, `photos/00001-a.jpg` tagged `family`, and `photos/00002-b.jpg` tagged `family` and `scary`
- **AND** the filter Christmas, any of `christmas` and `family`, except `scary`
- **WHEN** Christmas plays three items
- **THEN** they are `photos/00001-a.jpg`, `christmas/tree.mp4`, then `photos/00001-a.jpg` again

#### Scenario: a box tag puts an upload in a filter
- **GIVEN** `photos/00001-a.jpg` and `photos/00003-c.jpg` with the box tag `favorites`, `photos/00002-b.jpg`, and `halloween/fuzzy.mp4`
- **AND** the filter Family, any of `favorites`
- **WHEN** Family plays three items
- **THEN** they are `photos/00001-a.jpg`, `photos/00003-c.jpg`, then `photos/00001-a.jpg` again

### Requirement: Custom copies of GitHub filters are dropped
The first time the website starts with GitHub filters on the box, it SHALL drop every custom filter with a GitHub filter's name, ignoring case, from `filters.json`, and log each. It SHALL not do so again, so a custom filter that clashes later is only skipped.

#### Scenario: custom copies of the GitHub filters are dropped when the website starts
- **GIVEN** the starting filters from GitHub, and `filters.json` holding Halloween kid, Party and Thanksgiving
- **WHEN** the website starts
- **THEN** `filters.json` holds just Party
- **AND** the log says `Dropping the custom filter Halloween kid: GitHub has a filter of that name.` and the same for Thanksgiving

## REMOVED Requirements

### Requirement: The GitHub filters match today's window
**Reason**: Favorites and All uploads are no longer filters.
**Migration**: See "The GitHub filters are today's seasons" below.

## ADDED Requirements

### Requirement: The GitHub filters are today's seasons
The repo's GitHub filters (`playlists/filters.json`; "the starting filters" in other scenarios) SHALL be Halloween kid and grownup at today's days and times, and Thanksgiving on its days in the evening only.

#### Scenario: the GitHub filters are today's seasons
- **GIVEN** the repo's `playlists/filters.json`
- **WHEN** the box reads them
- **THEN** all three are usable, in this order:
  - Halloween kid: any of `halloween`, `halloween-kid`; Oct 1–31, 05:00–07:00 and 17:00–19:30;
  - Halloween grownup: any of `halloween`, `halloween-grownup`; Oct 1–31, 19:30–23:00;
  - Thanksgiving: any of `thanksgiving`; Fridays and Saturdays from Nov 1 to `11-4thu`, plus `11-4thu-1` and `11-4thu`; 17:00–23:00

### Requirement: A filter needs days and times
A filter SHALL have at least one schedule entry with days. The website SHALL refuse one without (`<name>: a filter needs days and times; to play tags any time, pick them under Play.`), and the box SHALL skip one in a file, logged once.

#### Scenario: a filter without days and times is refused and skipped
- **GIVEN** the upload PIN `4321`, and `filters.json` holding Favorites (any of `favorites`, no schedule), then Late
- **WHEN** the box reads the filters, and the website is asked with PIN `4321` to save Party (any of `halloween`, no schedule)
- **THEN** only Late is kept, and `ERROR: Ignoring filter 1 (Favorites): a filter needs days and times` is logged
- **AND** the save is refused with `Party: a filter needs days and times; to play tags any time, pick them under Play.`

#### Scenario: a custom filter without days and times is dropped when the website starts
- **GIVEN** the box's own filters are Favorites (any of `favorites`, no schedule), then Party (any of `halloween`, in December), saved before filters needed days and times
- **WHEN** the website starts
- **THEN** the box's own filters are just Party
- **AND** `Dropping the custom filter Favorites: a filter needs days and times now; pick its tags under Play instead.` is logged
