# filters Specification

## Purpose
Decides what a filter shows (every item with any of its tags and none of its except tags) and in what order, and keeps the box's filters: their order, editing them from the website with the PIN, the starting set, and what happens on screen when tags or filters change.

## Requirements

### Requirement: Items play in name order, round and round
A filter's items SHALL play sorted by file name with numbers sorted as numbers (then by folder), round and round, and a filter that comes back SHALL start again at the item it was on.

#### Scenario: a filter plays its items in name order, round and round
- **GIVEN** `halloween/2-b.mp4`, `halloween/kid/10-c.mp4`, `halloween/a.mp4`, and `photos/00001-x.jpg` with the box tag `halloween`
- **AND** the filter Halloween kid, any of `halloween` and `halloween-kid`
- **WHEN** Halloween kid plays eight items
- **THEN** they are `photos/00001-x.jpg`, `halloween/2-b.mp4`, `halloween/kid/10-c.mp4`, `halloween/a.mp4`, then the same four again

### Requirement: A filter with nothing to show is black
When a filter's tags match no item, the screen SHALL be black and the box SHALL log once, not as an error, that nothing has those tags yet.

#### Scenario: a filter with nothing in it shows black and says so once
- **GIVEN** the filter Halloween kid, any of `halloween` and `halloween-kid`, and no such items
- **WHEN** Halloween kid tries to play twice
- **THEN** nothing plays
- **AND** `Nothing in Halloween kid yet (any of halloween, halloween-kid). Showing black until something is tagged.` is logged once, and no error is logged

### Requirement: Tags or filters changing while a filter plays
When tags or the filters are saved while a filter plays, the box SHALL replace what is queued behind the item on screen with that filter's items as they now are, continuing after that item. If the item on screen no longer belongs, the box SHALL move on at once, without going black, to the next item after it in name order, or else the first, logging no error.

#### Scenario: tagging an item while its filter plays queues it in its place
- **GIVEN** Favorites playing `photos/00001-a.jpg`, with `photos/00003-c.jpg` queued, all tagged `favorites`
- **WHEN** `photos/00002-b.jpg` is tagged `favorites`
- **THEN** mpv's playlist is `photos/00001-a.jpg`, playing, then `photos/00002-b.jpg`, `photos/00003-c.jpg`

#### Scenario: untagging the item on screen moves on to the next item
- **GIVEN** Favorites playing `photos/00001-a.jpg`, with `photos/00002-b.jpg` and `photos/00003-c.jpg` queued, all tagged `favorites`
- **WHEN** `favorites` is taken off `photos/00001-a.jpg`
- **THEN** mpv's playlist is `photos/00002-b.jpg`, playing, then `photos/00003-c.jpg`, `photos/00002-b.jpg`
- **AND** no `ERROR:` line is logged

### Requirement: A removed upload leaves the screen cleanly
When an upload is removed through the website while a filter shows it, the box SHALL take it out of mpv's playlist before the file is deleted, moving on to the next item if it was showing, and SHALL log no error for it.

#### Scenario: removing the upload on screen moves on to the next
- **GIVEN** All uploads playing `00001-a.jpg`, with `00002-b.mp4` and `00003-c.png` queued
- **WHEN** `00001-a.jpg` is removed through the website
- **THEN** mpv's playlist starts with `photos/00002-b.mp4`, playing, and no longer holds `00001-a.jpg`
- **AND** no `ERROR:` line is logged

#### Scenario: removing a queued upload takes it out of the queue
- **GIVEN** All uploads playing `00001-a.jpg`, with `00002-b.mp4` and `00003-c.png` queued
- **WHEN** `00002-b.mp4` is removed through the website
- **THEN** `photos/00001-a.jpg` is still playing, and mpv's playlist no longer holds `00002-b.mp4`
- **AND** no `ERROR:` line is logged

### Requirement: The box keeps its filters, in order
The box SHALL keep its filters in `filters.json` in the video folder, in the person's order, each with a name, its "any of" tags, its "except" tags and its schedule entries. The website SHALL list them in that order.

#### Scenario: the website lists the filters
- **GIVEN** `filters.json` holding Halloween kid, then Favorites
- **WHEN** the website is asked for the filters
- **THEN** it answers with Halloween kid, then Favorites, each with its tags and schedule entries as saved

### Requirement: The website saves the filters with the PIN
With the right upload PIN, the website SHALL replace the box's filters with the list it is given, in order, and say so and log their names. It SHALL refuse a wrong or missing PIN, and a list with any filter it can't use (a bad or repeated name, `black`, no "any of" tags, a bad tag name, or a bad day or time), naming the filter and the problem and saving nothing. A name is 1 to 30 letters, digits, spaces, `-` or `'`.

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
  - one called `Kid (old)`;
  - one with no "any of" tags;
  - one with the tag `Fav Orites`;
  - one whose entry runs from `13-01`;
  - one whose times run from `25:00`
- **THEN** each request is refused with a message naming the filter and what is wrong
- **AND** `filters.json` still holds only Favorites

### Requirement: Bad filters in the filters file are skipped
The box SHALL skip, and log once as an error naming why, any filter or schedule entry in `filters.json` it can't use, and play the rest. A missing or unreadable `filters.json` SHALL mean no filters, logged once.

#### Scenario: a bad filter in the filters file is skipped and logged
- **GIVEN** `filters.json` holding a filter with no "any of" tags, then Christmas
- **WHEN** the box reads the filters twice
- **THEN** only Christmas is kept
- **AND** `ERROR: Ignoring filter 1` is logged once, saying it has no "any of" tags

#### Scenario: no filters file means no filters
- **GIVEN** no `filters.json`
- **WHEN** the box reads the filters twice
- **THEN** there are no filters
- **AND** `No filters on this box yet, so nothing is scheduled. Add one on the website.` is logged once

### Requirement: Setup gives a box the starting filters
Setup SHALL copy the repo's starting filters to `~/video-scheduler/filters.json` when the box has none, and SHALL never change a box's own filters.

#### Scenario: setup copies the starting filters to a box that has none
- **GIVEN** a box with no `filters.json`
- **WHEN** setup runs
- **THEN** `filters.json` holds the starting filters
- **AND** setup says `Added the starting filters (Halloween kid, Halloween grownup, Thanksgiving, Favorites, All uploads).`

#### Scenario: setup keeps a box's own filters
- **GIVEN** a box whose `filters.json` holds only Favorites
- **WHEN** setup runs
- **THEN** `filters.json` still holds only Favorites

### Requirement: The starting filters match today's window
The repo's starting filters SHALL be Halloween kid and grownup at today's days and times, Thanksgiving on its days in the evening only, then Favorites and All uploads, unscheduled. There is no Christmas filter until Christmas videos exist.

#### Scenario: the starting filters are today's seasons, favorites and uploads
- **GIVEN** the repo's starting filters
- **WHEN** the box reads them
- **THEN** all five are usable, in this order:
  - Halloween kid: any of `halloween`, `halloween-kid`; Oct 1–31, 05:00–07:00 and 17:00–19:30;
  - Halloween grownup: any of `halloween`, `halloween-grownup`; Oct 1–31, 19:30–23:00;
  - Thanksgiving: any of `thanksgiving`; Fridays and Saturdays from Nov 1 to `11-4thu`, plus `11-4thu-1` and `11-4thu`; 17:00–23:00;
  - Favorites: any of `favorites`; not scheduled;
  - All uploads: any of `upload`; not scheduled

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
- **AND** the filter Favorites, any of `favorites`
- **WHEN** Favorites plays three items
- **THEN** they are `photos/00001-a.jpg`, `photos/00003-c.jpg`, then `photos/00001-a.jpg` again
