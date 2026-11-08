# overrides Specification

## Purpose
Lets the person change what is on screen for a while from the box's website, for previews or to switch the screen off, without the change outliving the schedule.

## Requirements

### Requirement: Override until the schedule changes
An override with no time limit SHALL end when the schedule next changes, after which the schedule SHALL apply again.

#### Scenario: an override "until the schedule changes" ends at the next period
- **GIVEN** the starting filters, and an override to black with no time limit, set on Oct 20, 2026 at 5 PM
- **WHEN** the scheduler decides what to show at 7:29 PM and at 7:30 PM
- **THEN** at 7:29 PM the status is `black (override until the schedule changes at 7:30 PM)`
- **AND** at 7:30 PM Halloween grownup plays

### Requirement: Override with tags and filters
An override SHALL play everything with any of the tags it names, plus everything each filter it names picks, whatever the schedule, or black when it names nothing, and the status SHALL name the tags, each with `#`, then the filters, joined with ` + `, and how long the override lasts.

#### Scenario: an override plays the chosen tags whatever the schedule
- **GIVEN** the starting filters, `halloween/fuzzy.mp4`, `thanksgiving/dusk.mp4` and `christmas/tree.mp4`, and an override for the tags `halloween` and `thanksgiving` until cleared
- **WHEN** the box plays at 6 PM on Jan 15, 2026, four items
- **THEN** they are `thanksgiving/dusk.mp4`, `halloween/fuzzy.mp4`, then the same two again
- **AND** the status is `#halloween + #thanksgiving (override until cleared)`

#### Scenario: chosen tags with nothing in them show black and say so once
- **GIVEN** an override for the tag `easter` until cleared, and nothing tagged `easter`
- **WHEN** the box tries to play twice
- **THEN** nothing plays
- **AND** `Nothing tagged easter yet. Showing black until something is.` is logged once, and no error is logged

#### Scenario: an override plays chosen tags and filters together
- **GIVEN** the starting filters, `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4` and `photos/00001-a.jpg` tagged `favorites`, and an override for the tag `favorites` and the filter Halloween kid until cleared
- **WHEN** the box plays at 6 PM on Jan 15, 2026, three items
- **THEN** they are `photos/00001-a.jpg`, `halloween/fuzzy.mp4`, then `photos/00001-a.jpg` again
- **AND** the status is `#favorites + Halloween kid (override until cleared)`

### Requirement: A picked filter that's gone ends the override
When the override names a filter the box no longer has, and the box's filter files have no mistakes in them, the box SHALL end the override, removing the override file, follow the schedule, and log why once.

#### Scenario: an override naming a filter that's gone is ended and logged
- **GIVEN** the starting filters, and an override for the filter Easter until cleared
- **WHEN** the scheduler decides what to show at 6 PM on Oct 20, 2026
- **THEN** the override file is gone and Halloween kid plays
- **AND** `Ending the override: there is no filter called Easter any more.` is logged

### Requirement: An override from before tags ends
An override file naming a filter or a playlist, from before tags could be played, SHALL be removed and logged, and the schedule SHALL apply.

#### Scenario: an override from before tags is ended and logged
- **GIVEN** the starting filters, and an override file in the old form naming the filter Thanksgiving (`{"filter": "Thanksgiving"}`), then one naming the playlist `halloween/grownup`
- **WHEN** the scheduler decides what to show at 6 PM on Oct 20, 2026, each time
- **THEN** Halloween kid plays and the override file is gone each time
- **AND** `Ending an override from before tags could be played (Thanksgiving).` and `Ending an override from before tags could be played (halloween/grownup).` are logged

### Requirement: Override file checks for tags
An override SHALL name its tags as a list of tag names and its filters as a list of filter names, at least one in all, or tags `null` for black. Anything else SHALL be ignored and logged once.

#### Scenario: override file validation for tags
- **GIVEN** override files
- **WHEN** the scheduler reads them
- **THEN** `{"tags":["halloween","halloween-kid"],...}`, `{"tags":[],"filters":["Halloween kid"],...}` and `{"tags":null,...}` are accepted
- **AND** `{"tags":[]}`, `{"tags":["Fav Orites"]}`, `{"tags":"halloween"}`, `{"tags":[7]}` and `{"tags":[],"filters":["Kid (old)"]}` are rejected
