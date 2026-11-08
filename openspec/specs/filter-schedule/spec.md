# filter-schedule Specification

## Purpose
Decides which filter, if any, plays at each moment from the filters' own schedule entries (days and times), which filter wins where entries overlap, and what the status line says, so the window is only lit at the planned times and shows the planned things.

## Requirements

### Requirement: Scheduled filters play on their days and times
A filter SHALL play while one of its schedule entries covers the moment: the day is one of the entry's days and the time is within one of its times (start included, stop not); an entry with no times covers its days all day. The status SHALL name the filter and when what plays next changes.

#### Scenario: a scheduled filter plays on its days and times
- **GIVEN** the starting filters
- **WHEN** the scheduler decides what to show at 6:00 PM on Tuesday, Oct 20, 2026
- **THEN** Halloween kid plays
- **AND** the status is `Halloween kid (scheduled until 7:30 PM)`

#### Scenario: the next filter takes over when its time starts
- **GIVEN** the starting filters
- **WHEN** the scheduler decides what to show at 7:29 PM and at 7:30 PM on Oct 20, 2026
- **THEN** Halloween kid plays at 7:29 PM and Halloween grownup at 7:30 PM, with the status `Halloween grownup (scheduled until 11:00 PM)`

### Requirement: Black when nothing is scheduled
When no filter's entry covers the moment, the screen SHALL be black, and the status SHALL say when something is next scheduled within a day, or that nothing is.

#### Scenario: outside every entry the screen is black
- **GIVEN** the starting filters
- **WHEN** the scheduler decides what to show at 11:30 PM on Oct 20, 2026, and at 6:00 PM on Jan 15, 2026
- **THEN** both are black
- **AND** the statuses are `black (nothing scheduled until Wed 5:00 AM)` and `black (nothing scheduled)`

### Requirement: Days are inclusive ranges
An entry's days SHALL run from the start of its first day to the end of its last day. When the last day comes before the first, the range SHALL run across the new year.

#### Scenario: schedule days are inclusive and can wrap the new year
- **GIVEN** a filter scheduled Oct 1 to Oct 31, and a filter Winter scheduled Dec 15 to Jan 6, each all day
- **WHEN** the scheduler checks Sept 30, Oct 1 at 12:00 AM, Oct 31 at 11:59 PM, Dec 14, Dec 15, Jan 6 and Jan 7
- **THEN** the first is on Oct 1 and Oct 31 only, and Winter on Dec 15 and Jan 6 only

### Requirement: Ways to write a day
A day SHALL be written as `MM-DD`, as the nth or last weekday of a month (`11-4thu`, `05-lastmon`), either with a `+N` or `-N` day offset, or (in extra days only) as `YYYY-MM-DD`. A day that does not exist that year SHALL match nothing, and malformed text SHALL be rejected.

#### Scenario: days written as the nth or last weekday of a month, with offsets
- **GIVEN** day texts for 2026, 2027 and 2028
- **WHEN** the scheduler reads them
- **THEN** `11-4thu` is Nov 26, 2026, `11-4thu-1` is Nov 25, `11-4thu+1` is Nov 27, `05-lastmon` is May 25 and `09-1mon` is Sept 7
- **AND** `01-01-1` is Dec 31, 2025, `02-29` is Feb 29 in 2028 and nothing in 2026, and `11-5thu` is nothing in 2026
- **AND** `2026-11-14` is Nov 14, 2026 among extra days, nothing in 2027, and rejected as a first or last day
- **AND** `11-4xyz`, `11-6thu`, `13-01`, `11-31`, `11-04thu`, `thanksgiving` and an empty text are rejected

### Requirement: Weekdays and extra days
An entry with weekdays SHALL cover only those weekdays within its range. An extra day SHALL be covered whatever its weekday, even outside the range, and a `YYYY-MM-DD` day only in that year. An entry with no range SHALL cover only its extra days.

#### Scenario: weekdays within the range, and extra days outside it or with a year
- **GIVEN** an entry from June 1 to June 30 on Saturday and Sunday, with extra days `07-04` and `2026-08-15`
- **WHEN** the scheduler checks days in 2026 and 2027
- **THEN** it covers Sat June 6 and Sun June 7 but not Mon June 8
- **AND** it covers July 4 and Aug 15, 2026, but not Aug 15, 2027

#### Scenario: Thanksgiving: Fridays and Saturdays until Thanksgiving, then the day before and the day
- **GIVEN** the starting Thanksgiving filter
- **WHEN** the scheduler checks 8 PM on each day of November
- **THEN** Thanksgiving is scheduled on Nov 6, 7, 13, 14, 20, 21, 25 and 26 in 2026
- **AND** on Nov 5, 6, 12, 13, 19, 20, 24 and 25 in 2027
- **AND** on Nov 1, 7, 8, 14, 15, 21, 22, 26 and 27 in 2025

### Requirement: Times that cross midnight
A time whose stop comes before its start SHALL run past midnight and belong to the day it starts on: the entry's days are judged by that day.

#### Scenario: a time that crosses midnight belongs to the day it starts
- **GIVEN** a filter Late scheduled from Jan 1 to Dec 31 on Fridays only, from 10 PM to 1 AM
- **WHEN** the scheduler decides what to show on Fri Oct 23, 2026 at 11 PM, Sat Oct 24 at 12:30 AM, and Sat Oct 24 at 11 PM
- **THEN** Late plays at 11 PM on Friday and at 12:30 AM after it, with the status at 11 PM `Late (scheduled until Sat 1:00 AM)`
- **AND** the screen is black at 11 PM on Saturday

### Requirement: The higher filter wins on overlap
Where entries of two filters cover the same moment, the filter that comes first in the box's list SHALL play.

#### Scenario: where two filters' entries overlap, the higher one plays
- **GIVEN** the filters Christmas (Dec 1–31, 17:00–23:00) and then Winter (Dec 15–Jan 6, 17:00–23:00)
- **WHEN** the scheduler decides what to show at 6 PM on Dec 10, Dec 20 and Jan 6
- **THEN** Christmas plays on Dec 10 and Dec 20, and Winter on Jan 6
