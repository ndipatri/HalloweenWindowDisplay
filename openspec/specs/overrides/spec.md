# overrides Specification

## Purpose
Lets the person change what is on screen for a while from the box's website, for previews or to switch the screen off, without the change outliving the schedule.

## Requirements

### Requirement: Override with a playlist name
An override naming a plain playlist (such as `grownup`) SHALL play that playlist within today's season, and the status SHALL say it is an override and how long it lasts.

#### Scenario: override with a plain playlist uses today's season
- **GIVEN** an override for `grownup` until cleared, on Oct 20, 2026
- **WHEN** the scheduler decides what to show at 6 PM
- **THEN** `halloween/grownup` plays
- **AND** the status is `halloween/grownup (override until cleared)`

### Requirement: Override previewing another season
An override naming a season, or a season and playlist, SHALL play exactly that, whatever today's season is.

#### Scenario: override can preview another season, with or without a playlist
- **GIVEN** an override until cleared on Oct 20, 2026
- **WHEN** the override is `christmas`, and then `christmas/grownup`
- **THEN** `christmas` plays, and then `christmas/grownup`

### Requirement: Override on a day with no season
An override naming a plain playlist on a day no season covers SHALL show black, and the status SHALL explain that there is no season today.

#### Scenario: override of a plain playlist on a day with no season explains the black
- **GIVEN** an override for `kid` until cleared, set on Jan 15, 2026
- **WHEN** the scheduler decides what to show at 6 PM
- **THEN** nothing plays
- **AND** the status is `black (override until cleared; asked for kid but no season today)`

### Requirement: Override until the schedule changes
An override with no time limit SHALL end when the schedule next changes, after which the schedule SHALL apply again.

#### Scenario: an override "until the schedule changes" ends at the next period
- **GIVEN** an override to black with no time limit, set on Oct 20, 2026 at 5 PM
- **WHEN** the scheduler decides what to show at 7:29 PM and at 7:30 PM
- **THEN** at 7:29 PM the status is `black (override until the schedule changes at 7:30 PM)`
- **AND** at 7:30 PM `halloween/grownup` plays

### Requirement: Override file checks
An override SHALL name a playlist as `name` or `season/name`, or no playlist for black. Anything else, including empty names, hidden names and paths leaving the video folder, SHALL be rejected.

#### Scenario: override file validation
- **GIVEN** override files naming a playlist
- **WHEN** the scheduler reads them
- **THEN** `kid`, `christmas/kid` and no playlist are accepted
- **AND** `../x`, `a/b/c`, `.hidden`, `a/.b` and an empty name are rejected
