# Spec Delta

## REMOVED Requirements

### Requirement: The page picks and plays
**Reason**: Its Play my picks button is removed as redundant with My picks under Play; replaced by "The page picks", whose confirmation scenario is renamed to match.
**Migration**: See "The page picks" below.

## ADDED Requirements

### Requirement: The page picks
The page SHALL offer a My picks section listing each item from the website's list under its group with a tick box, the picked ones numbered in pick order. It SHALL save the picks on every tick or untick (a ticked item goes to the end; the numbers after an unticked one close up), and confirm each save under the list, in view while it scrolls.

#### Scenario: the website page offers My picks
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a My picks section that shows each item from the website's picks list under its group, with a tick box, and the picked ones numbered in order
- **AND** a tick or untick saves the picks

#### Scenario: the page puts a ticked item at the end of the picks and closes up an unticked one
- **GIVEN** the page with the picks `thanksgiving/dusk.mp4`, `photos/00001-a.jpg`, `halloween/fuzzy.mp4`
- **WHEN** the person ticks `halloween/grownup/jump.mp4`, then unticks `photos/00001-a.jpg`
- **THEN** the picks saved are first `thanksgiving/dusk.mp4`, `photos/00001-a.jpg`, `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4`, then `thanksgiving/dusk.mp4`, `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4`

#### Scenario: the page confirms the picks next to the list
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** the My picks section says `Each tick is saved straight away.`
- **AND** under the list it shows `Saving…` while a tick is saved, then `✓ Saved.` with how many are picked and `Tap My picks under Play to show them.`, or `Showing on the window now.` while My picks is on, or `Nothing picked yet.`
- **AND** the section has no button of its own to play the picks
