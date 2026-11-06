# Spec Delta

## REMOVED Requirements

### Requirement: Lists the choices
**Reason**: Replaced by "Lists what it can show", which renames Photos to All uploads and adds My picks; its two Photos scenarios are renamed to match.
**Migration**: See "Lists what it can show" below.

## ADDED Requirements

### Requirement: Lists what it can show
The website SHALL list what it can show: the playlists named in the schedule, All uploads, My picks, and every season folder and season/playlist folder on the box other than `photos` and `picks`, and its page SHALL offer each of them, black, the durations, and back to the schedule.

#### Scenario: the website lists what it can show
- **GIVEN** the shipped schedule and folders `halloween`, `halloween/grownup` and `thanksgiving`
- **WHEN** the website is asked for its choices
- **THEN** the playlists are `kid` and `grownup`
- **AND** the previews are `halloween`, `halloween/grownup` and `thanksgiving`

#### Scenario: the website page offers each choice
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a button for black and for Back to schedule, and a choice of until the schedule changes, 15, 30 or 60 minutes, or until switched back

#### Scenario: the website offers All uploads and My picks apart from the season previews
- **GIVEN** the shipped schedule and folders `halloween`, `photos`, `photos/old` and `picks`
- **WHEN** the website is asked for its choices
- **THEN** it offers All uploads and My picks
- **AND** the previews are just `halloween`

#### Scenario: the website page offers All uploads and My picks buttons
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has an All uploads button that shows `photos`, and a My picks button that shows `picks`, each for the chosen duration
