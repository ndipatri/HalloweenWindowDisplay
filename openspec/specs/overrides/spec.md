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

### Requirement: Override with a filter
An override SHALL play the filter it names, whatever that filter's schedule, or black, and the status SHALL name the filter and how long the override lasts.

#### Scenario: an override plays the chosen filter whatever its schedule
- **GIVEN** the starting filters, and an override for Thanksgiving until cleared
- **WHEN** the scheduler decides what to show at 6 PM on Oct 20, 2026, and at 6 PM on Jan 15, 2026
- **THEN** Thanksgiving plays both times
- **AND** the status is `Thanksgiving (override until cleared)`

### Requirement: An override for a filter that's gone ends
When the override names a filter the box no longer has, the box SHALL end the override, removing the override file, follow the schedule, and log why once.

#### Scenario: an override for a filter that's gone is ended and logged
- **GIVEN** the starting filters, and an override for Easter until cleared
- **WHEN** the scheduler decides what to show at 6 PM on Oct 20, 2026
- **THEN** the override file is gone and Halloween kid plays
- **AND** `Ending the override: there is no filter called Easter any more.` is logged

### Requirement: Override file checks for filters
An override SHALL name a filter as `filter`, or no filter for black. A file that names a playlist the old way SHALL be removed and logged; any other file that isn't a filter name SHALL be ignored and logged once.

#### Scenario: override file validation for filters
- **GIVEN** override files
- **WHEN** the scheduler reads them
- **THEN** `{"filter":"Halloween kid",...}` and `{"filter":null,...}` are accepted
- **AND** `{"playlist":"halloween/grownup",...}`, a filter name that is empty, longer than 30 characters or has `(`, and a filter that is a number are rejected
