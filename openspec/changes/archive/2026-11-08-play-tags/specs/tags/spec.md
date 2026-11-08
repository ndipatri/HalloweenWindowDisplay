# Spec Delta

## MODIFIED Requirements

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
- **THEN** `halloween/fuzzy.mp4` has no box tags and the tag `favorites` plays only `photos/00001-a.jpg`
- **AND** `tags.json` no longer mentions `halloween/fuzzy.mp4`
