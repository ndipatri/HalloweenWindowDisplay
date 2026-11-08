# Spec Delta

## REMOVED Requirements

### Requirement: A filter shows the items with any of its tags, except its except tags
**Reason**: Its box-tag scenario put a repo video in a filter by a box tag, which is no longer possible.
**Migration**: See "A filter shows what has any of its tags, except its except tags" below.

## MODIFIED Requirements

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

## ADDED Requirements

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
