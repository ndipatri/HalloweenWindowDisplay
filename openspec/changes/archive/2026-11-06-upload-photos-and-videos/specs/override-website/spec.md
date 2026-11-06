# Spec Delta

## MODIFIED Requirements

### Requirement: Lists the choices
The website SHALL list what it can show: the playlists named in the schedule, Photos, and every season folder and season/playlist folder on the box other than `photos`, and its page SHALL offer each of them, black, the durations, and back to the schedule.

#### Scenario: the website lists what it can show
- **GIVEN** the shipped schedule and folders `halloween`, `halloween/grownup` and `thanksgiving`
- **WHEN** the website is asked for its choices
- **THEN** the playlists are `kid` and `grownup`
- **AND** the previews are `halloween`, `halloween/grownup` and `thanksgiving`

#### Scenario: the website page offers each choice
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a button for black and for Back to schedule, and a choice of until the schedule changes, 15, 30 or 60 minutes, or until switched back

#### Scenario: the website offers Photos apart from the season previews
- **GIVEN** the shipped schedule and folders `halloween`, `photos` and `photos/old`
- **WHEN** the website is asked for its choices
- **THEN** it offers Photos
- **AND** the previews are just `halloween`

#### Scenario: the website page offers a Photos button
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a Photos button that shows `photos` for the chosen duration

