# Spec Delta

## Purpose
Gives every item on the box, repo video or upload, the tags that filters choose by: one tag from its folder in GitHub, `upload` for uploads, and any tags the box adds itself.

## ADDED Requirements

### Requirement: Folders give each video one tag
Every video in a folder or subfolder of the video folder (other than `photos`) SHALL be an item with one folder tag: its folder path, lowercased, with `/` and every character other than a letter, digit or dash turned into `-`. Photo files in those folders, and videos deeper than one subfolder, SHALL not be items.

#### Scenario: a video's tag is its folder path joined with dashes
- **GIVEN** videos `halloween/fuzzy.mp4`, `halloween/kid/x.mp4`, `halloween/grownup/y.mp4` and `Easter Eggs/z.mp4`
- **WHEN** the box reads the items
- **THEN** their folder tags are `halloween`, `halloween-kid`, `halloween-grownup` and `easter-eggs`, one each

#### Scenario: a photo in a repo folder is not an item
- **GIVEN** a `halloween` folder with `fuzzy.mp4` and `poster.jpg`
- **WHEN** the box reads the items
- **THEN** only `halloween/fuzzy.mp4` is an item

### Requirement: Folders that can't make a tag
A folder whose tag comes out empty or longer than 30 characters SHALL have its videos left out, logged once. Two folders giving the same tag SHALL share it.

#### Scenario: a folder whose name makes no tag is left out and logged once
- **GIVEN** videos `halloween/kid/a.mp4`, `halloween-kid/b.mp4`, `!!!/c.mp4`, and a video in a folder with a 40-letter name
- **WHEN** the box reads the items twice
- **THEN** `a.mp4` and `b.mp4` are items tagged `halloween-kid`, and the other two are not items
- **AND** `Leaving out !!!: its name doesn't make a tag (at most 30 letters, digits and dashes).` is logged once, and the same for the long folder

### Requirement: Every upload is tagged upload
Every photo or video in `photos/` (not hidden files) SHALL be an item tagged `upload`, and no other item SHALL have that tag.

#### Scenario: an upload is tagged upload
- **GIVEN** `photos/00001-a.jpg`, `photos/00002-b.mov` and `photos/.upload-1`
- **WHEN** the box reads the items
- **THEN** `photos/00001-a.jpg` and `photos/00002-b.mov` are items tagged `upload`, and `.upload-1` is not an item

### Requirement: The box adds its own tags to any item
The website SHALL add or remove a box tag on any item, with no PIN, keeping box tags in `tags.json` in the video folder, and SHALL log each change. A tag name SHALL be 1 to 30 lowercase letters, digits and dashes, not starting or ending with a dash. `upload` and an item's folder tag SHALL not be added or removed this way. A box tag SHALL be accepted even when it repeats another item's folder tag.

#### Scenario: the website adds a box tag to an item
- **GIVEN** a `halloween` folder with `fuzzy.mp4`
- **WHEN** the website is asked to tag `halloween/fuzzy.mp4` with `favorites`
- **THEN** the item's tags are `halloween` and `favorites`
- **AND** the website answers `Tagged fuzzy.mp4 favorites.`
- **AND** the log says `Tags: halloween/fuzzy.mp4 + favorites (from the website).`

#### Scenario: the website removes a box tag from an item
- **GIVEN** `halloween/fuzzy.mp4` with the box tag `favorites`
- **WHEN** the website is asked to remove `favorites` from it
- **THEN** its only tag is `halloween`
- **AND** the website answers `Took favorites off fuzzy.mp4.`

#### Scenario: a box tag can repeat a folder tag
- **GIVEN** `photos/00001-a.jpg` and a `halloween` folder
- **WHEN** the website is asked to tag `photos/00001-a.jpg` with `halloween`
- **THEN** the upload's tags are `upload` and `halloween`

#### Scenario: the website refuses a tag name it can't use
- **GIVEN** a `halloween` folder with `fuzzy.mp4`
- **WHEN** the website is asked to tag it with `Fav Orites`, then an empty tag, then `-x`, then a 31-letter tag
- **THEN** each is refused with `Not a tag name:` followed by `Use lowercase letters, digits and dashes.`
- **AND** when asked to tag it with `upload`, it is refused with `upload is given to every upload by the box.`
- **AND** the item's tags are unchanged

#### Scenario: a folder tag can't be removed
- **GIVEN** a `halloween` folder with `fuzzy.mp4`
- **WHEN** the website is asked to remove `halloween` from it
- **THEN** it is refused with `halloween comes from the folder in GitHub, so it can't be taken off here.`

#### Scenario: the website refuses to tag something that isn't an item
- **GIVEN** a `halloween` folder with `fuzzy.mp4` and `poster.jpg`, and the status file
- **WHEN** the website is asked to tag `../status`, then `halloween/poster.jpg`, then `halloween/missing.mp4` with `favorites`
- **THEN** each is refused with `No item` and the path
- **AND** `tags.json` is unchanged

### Requirement: Lists the items and their tags
The website SHALL list every item with its path, the group it is shown under (its folder written as words, or `Uploads`), its folder tags and its box tags, folders in name order with their videos in name order, then the uploads in upload order, and SHALL list every tag in use, in name order.

#### Scenario: the website lists the items and their tags
- **GIVEN** `halloween/fuzzy.mp4` with the box tag `favorites`, `halloween/kid/x.mp4`, `thanksgiving/dusk.mp4`, and `photos/00001-a.jpg` with the box tag `family`
- **WHEN** the website is asked for the items
- **THEN** the items are, in order:
  - `halloween/fuzzy.mp4` (Halloween; `halloween`; `favorites`);
  - `halloween/kid/x.mp4` (Halloween / Kid; `halloween-kid`);
  - `thanksgiving/dusk.mp4` (Thanksgiving; `thanksgiving`);
  - `photos/00001-a.jpg` (Uploads; `upload`; `family`)
- **AND** the tags in use are `family`, `favorites`, `halloween`, `halloween-kid`, `thanksgiving` and `upload`

### Requirement: Box tags follow their items
Box tags on an item that is no longer on the box SHALL be left out of every list and every filter, and removing an upload on the website SHALL drop its box tags.

#### Scenario: box tags of an item no longer on the box are left out
- **GIVEN** `tags.json` giving `halloween/gone.mp4` the tag `favorites`, and no such file
- **WHEN** the website is asked for the items
- **THEN** no item is `halloween/gone.mp4`, and `favorites` is not among the tags in use

#### Scenario: removing an upload drops its box tags
- **GIVEN** the upload PIN `4321` and `photos/00001-a.jpg` with the box tag `family`
- **WHEN** the website is asked to remove `00001-a.jpg` with PIN `4321`
- **THEN** `tags.json` no longer mentions `photos/00001-a.jpg`

### Requirement: My picks become favorites
When the box finds the old `picks.json`, it SHALL give each pick still on the box the box tag `favorites`, remove `picks.json`, and log how many it moved.

#### Scenario: the box turns the old picks into favorites
- **GIVEN** `picks.json` holding `halloween/fuzzy.mp4`, `photos/00001-a.jpg` and `halloween/gone.mp4`, of which the first two are on the box
- **WHEN** the website starts
- **THEN** `halloween/fuzzy.mp4` and `photos/00001-a.jpg` have the box tag `favorites`
- **AND** `picks.json` is gone
- **AND** the log says `My picks are now tagged favorites (2).`
