# daily-schedule Specification

## Purpose
Decides when the screen is on each day and which playlist plays, and reports what is on screen and why, so the window is only lit at the planned times.

## Requirements

### Requirement: Status names the season and the end of the period
During a schedule period the screen SHALL play today's season with the period's playlist, and the status SHALL name both and when the period ends. Outside every period the screen SHALL be black, and the status SHALL say when the next period starts.

#### Scenario: schedule status names the season
- **GIVEN** the shipped schedule and seasons, on Tuesday, Oct 20, 2026
- **WHEN** the scheduler decides what to show at 6 PM, 8 PM, 11:30 PM and noon
- **THEN** the status is `halloween/kid (scheduled until 7:30 PM)`, `halloween/grownup (scheduled until 11:00 PM)` and `black (outside schedule until Wed 5:00 AM)`
- **AND** nothing plays at noon

### Requirement: No season means black
During a schedule period on a day no season covers, the screen SHALL be black, and the status SHALL say there is no season today, with the date.

#### Scenario: a scheduled period on a day with no season is black
- **GIVEN** the shipped schedule and seasons
- **WHEN** the scheduler decides what to show on Jan 15, 2026 at 6 PM
- **THEN** nothing plays
- **AND** the status is `black (no season today, Jan 15)`

#### Scenario: on a weekday a season skips, the screen is black
- **GIVEN** the shipped schedule and seasons
- **WHEN** the scheduler decides what to show at 8 PM on Monday, Nov 2, 2026 and on Friday, Nov 6, 2026
- **THEN** on Monday nothing plays and the status is `black (no season today, Nov 2)`
- **AND** on Friday `thanksgiving/grownup` plays

### Requirement: Periods that cross midnight
A period that crosses midnight SHALL belong to the day it starts on, and the season SHALL change at midnight inside it.

#### Scenario: the season switches at midnight inside a period that crosses it
- **GIVEN** a grownup period from 10 PM to 2 AM, halloween in October and thanksgiving in November
- **WHEN** the scheduler decides what to show on Oct 31, 2026 at 11 PM and on Nov 1 at 12:30 AM
- **THEN** the status at 11 PM is `halloween/grownup (scheduled until Sun 12:00 AM)`
- **AND** `thanksgiving/grownup` plays at 12:30 AM

### Requirement: Periods limited to weekdays
A period with `days` SHALL apply only on those weekdays, judged by the day it starts on. A period with an unknown weekday SHALL be skipped and logged.

#### Scenario: a schedule period can be limited to weekdays
- **GIVEN** a kid period 9 to 11 AM on Saturday and Sunday, and a grownup period 10 PM to 1 AM on Friday, with no seasons
- **WHEN** the scheduler decides what to show in October 2026
- **THEN** kid plays on Sat Oct 24 at 10 AM but nothing on Mon Oct 26 at 10 AM
- **AND** grownup plays on Fri Oct 23 at 11 PM and at 12:30 AM after it, but not on Saturday night or after its midnight
- **AND** a period with the weekday "someday" is skipped, with one line logged
