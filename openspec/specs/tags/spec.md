# tags Specification

## Purpose
Gives every item on the box the tags that filters choose by: a video from GitHub has one tag, from its folder there; an upload has `upload` and any tags the box adds to it itself.

## Requirements

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

### Requirement: Box tags follow their items
Box tags on an item that is no longer on the box, or on a video from GitHub, SHALL be left out of every list and every filter, and dropped the next time the box's tags are saved. Removing an upload on the website SHALL drop its box tags.

#### Scenario: box tags of an item no longer on the box are left out
- **GIVEN** `tags.json` giving `photos/00009-gone.jpg` the tag `family`, and no such file
- **WHEN** the website is asked for the items
- **THEN** no item is `photos/00009-gone.jpg`, and `family` is not among the tags in use

#### Scenario: removing an upload drops its box tags
- **GIVEN** the upload PIN `4321` and `photos/00001-a.jpg` with the box tag `family`
- **WHEN** the website is asked to remove `00001-a.jpg` with PIN `4321`
- **THEN** `tags.json` no longer mentions `photos/00001-a.jpg`

#### Scenario: box tags on a video from GitHub are ignored and dropped
- **GIVEN** `halloween/fuzzy.mp4`, `photos/00001-a.jpg`, and `tags.json` giving both the tag `favorites`
- **WHEN** the box reads the items, and then the website is asked to tag `photos/00001-a.jpg` with `family`
- **THEN** `halloween/fuzzy.mp4` has no box tags and the filter Favorites plays only `photos/00001-a.jpg`
- **AND** `tags.json` no longer mentions `halloween/fuzzy.mp4`

### Requirement: My picks become favorites
When the box finds the old `picks.json`, it SHALL give each upload among the picks that is still on the box the box tag `favorites`, remove `picks.json`, and log how many it moved. Picks that are videos from GitHub SHALL be left out.

#### Scenario: the box turns the old picks into favorites
- **GIVEN** `picks.json` holding `halloween/fuzzy.mp4`, `photos/00001-a.jpg` and `photos/00009-gone.jpg`, of which the first two are on the box
- **WHEN** the website starts
- **THEN** `photos/00001-a.jpg` has the box tag `favorites`, and `halloween/fuzzy.mp4` has none
- **AND** `picks.json` is gone
- **AND** the log says `My picks are now tagged favorites (1).`

### Requirement: The box adds its own tags to uploads
The website SHALL add or remove a box tag on an upload, with no PIN, keeping box tags in `tags.json` in the video folder, and SHALL log each change. It SHALL refuse to tag a video from GitHub. A tag name SHALL be 1 to 30 lowercase letters, digits and dashes, not starting or ending with a dash. `upload` SHALL not be added or removed this way. A box tag SHALL be accepted even when it repeats a folder tag.

#### Scenario: the website adds a box tag to an upload
- **GIVEN** `photos/00001-a.jpg`
- **WHEN** the website is asked to tag `photos/00001-a.jpg` with `favorites`
- **THEN** the upload's tags are `upload` and `favorites`
- **AND** the website answers `Tagged 00001-a.jpg favorites.`
- **AND** the log says `Tags: photos/00001-a.jpg + favorites (from the website).`

#### Scenario: the website removes a box tag from an upload
- **GIVEN** `photos/00001-a.jpg` with the box tag `favorites`
- **WHEN** the website is asked to remove `favorites` from it
- **THEN** its only tag is `upload`
- **AND** the website answers `Took favorites off 00001-a.jpg.`

#### Scenario: a box tag can repeat a folder tag
- **GIVEN** `photos/00001-a.jpg` and a `halloween` folder
- **WHEN** the website is asked to tag `photos/00001-a.jpg` with `halloween`
- **THEN** the upload's tags are `upload` and `halloween`

#### Scenario: the website refuses a tag name it can't use
- **GIVEN** `photos/00001-a.jpg`
- **WHEN** the website is asked to tag it with `Fav Orites`, then an empty tag, then `-x`, then a 31-letter tag
- **THEN** each is refused with `Not a tag name:` followed by `Use lowercase letters, digits and dashes.`
- **AND** when asked to tag it with `upload`, or to take `upload` off it, it is refused with `upload is given to every upload by the box.`
- **AND** the upload's tags are unchanged

#### Scenario: the website refuses to tag a video from GitHub
- **GIVEN** `halloween/fuzzy.mp4`
- **WHEN** the website is asked to tag it with `favorites`, then to take `halloween` off it
- **THEN** each is refused with `halloween/fuzzy.mp4 comes from GitHub: its tag comes from its folder there.`
- **AND** `tags.json` is unchanged

#### Scenario: the website refuses to tag something that isn't an item
- **GIVEN** `photos/00001-a.jpg`, a `halloween` folder with `poster.jpg`, and the status file
- **WHEN** the website is asked to tag `../status`, then `halloween/poster.jpg`, then `photos/missing.jpg` with `favorites`
- **THEN** each is refused with `No item` and the path
- **AND** `tags.json` is unchanged

### Requirement: Lists the uploads and their tags
The website SHALL list every upload, in upload order, with its path, its tags (`upload`) and its box tags, and SHALL list every tag in use on any item, folder tags included, in name order.

#### Scenario: the website lists the uploads and their tags
- **GIVEN** `halloween/fuzzy.mp4`, `halloween/kid/x.mp4`, `photos/00001-a.jpg` with the box tag `family`, and `photos/00002-b.mov`
- **WHEN** the website is asked for the items
- **THEN** the items are `photos/00001-a.jpg` (`upload`; `family`), then `photos/00002-b.mov` (`upload`)
- **AND** the tags in use are `family`, `halloween`, `halloween-kid` and `upload`
