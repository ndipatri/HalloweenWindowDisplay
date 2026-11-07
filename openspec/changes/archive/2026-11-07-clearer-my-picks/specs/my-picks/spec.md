# Spec Delta

## MODIFIED Requirements

### Requirement: The page picks and plays
The page SHALL offer a My picks section listing every item from the website's list under its group, each with a tick box, the picked ones ticked and numbered in pick order, and SHALL save the picks whenever one is ticked or unticked: a ticked item goes to the end, and an unticked one comes out with the numbers after it closing up. It SHALL say at the top of the section that each tick is saved straight away, and under the list, in view while the list scrolls, SHALL confirm each save there with how many are picked and what to do next, and offer a Play my picks button that answers there when tapped.

#### Scenario: the website page offers My picks
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a My picks section that shows each item from the website's picks list under its group, with a tick box, and the picked ones numbered in order
- **AND** a tick or untick saves the picks

#### Scenario: the page puts a ticked item at the end of the picks and closes up an unticked one
- **GIVEN** the page with the picks `thanksgiving/dusk.mp4`, `photos/00001-a.jpg`, `halloween/fuzzy.mp4`
- **WHEN** the person ticks `halloween/grownup/jump.mp4`, then unticks `photos/00001-a.jpg`
- **THEN** the picks saved are first `thanksgiving/dusk.mp4`, `photos/00001-a.jpg`, `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4`, then `thanksgiving/dusk.mp4`, `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4`

#### Scenario: the page confirms the picks next to the list and offers Play my picks
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** the My picks section says `Each tick is saved straight away.`
- **AND** under the list it shows `Saving…` while a tick is saved, then `✓ Saved.` with how many are picked and `Tap Play my picks to show them.`, or `Showing on the window now.` while My picks is on, or `Nothing picked yet.`
- **AND** it has a Play my picks button there that shows `picks` for the chosen duration, reading `Starting…` while it does, after which the note says `▶ Playing your picks` and until when
