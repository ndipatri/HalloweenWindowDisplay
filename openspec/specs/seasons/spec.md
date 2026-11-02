# seasons Specification

## Purpose
Decides which season's videos, if any, play on each day of the year, so the window follows the holidays and stays black on days no season covers.

## Requirements

### Requirement: Configured seasons are valid
Every season entry in the shipped configuration SHALL pass validation, so none is silently dropped.

#### Scenario: configured seasons are all valid
- **GIVEN** the seasons in the shipped configuration (halloween, thanksgiving, christmas)
- **WHEN** the scheduler validates them
- **THEN** every entry is kept

### Requirement: Season days are inclusive
A season SHALL be active from the start of its first day to the end of its last day, and no season SHALL be active on a day that no entry covers.

#### Scenario: season boundaries are inclusive
- **GIVEN** the shipped seasons
- **WHEN** the scheduler picks the season for Sept 30, Oct 1 at 12:00 AM, Oct 31 at 11:59 PM, Nov 6 at 12:00 AM, Dec 1, Dec 31 and Jan 1, 2026
- **THEN** it picks none, halloween, halloween, thanksgiving, christmas, christmas and none

### Requirement: Thanksgiving season days
The thanksgiving season SHALL play on the Fridays and Saturdays of November up to Thanksgiving (the fourth Thursday), and on the day before Thanksgiving and Thanksgiving Day, moving with the year.

#### Scenario: Thanksgiving: Fridays and Saturdays until Thanksgiving, then the day before and the day
- **GIVEN** the shipped seasons
- **WHEN** the scheduler picks the season at 8 PM on each day of November
- **THEN** thanksgiving is active on Nov 6, 7, 13, 14, 20, 21, 25 and 26 in 2026
- **AND** on Nov 5, 6, 12, 13, 19, 20, 24 and 25 in 2027
- **AND** on Nov 1, 7, 8, 14, 15, 21, 22, 26 and 27 in 2025

### Requirement: Ways to write a day
A season day SHALL be written as `MM-DD`, as the nth or last weekday of a month (`11-4thu`, `05-lastmon`), either with a `+N` or `-N` day offset, or (in `alsoOn` only) as `YYYY-MM-DD`. A day that does not exist that year SHALL match nothing, and malformed text SHALL be rejected.

#### Scenario: days written as the nth or last weekday of a month, with offsets
- **GIVEN** day texts for 2026, 2027 and 2028
- **WHEN** the scheduler reads them
- **THEN** `11-4thu` is Nov 26, 2026, `11-4thu-1` is Nov 25, `11-4thu+1` is Nov 27, `05-lastmon` is May 25 and `09-1mon` is Sept 7
- **AND** `01-01-1` is Dec 31, 2025, `02-29` is Feb 29 in 2028 and nothing in 2026, and `11-5thu` is nothing in 2026
- **AND** `2026-11-14` is Nov 14, 2026 in `alsoOn`, nothing in 2027, and rejected outside `alsoOn`
- **AND** `11-4xyz`, `11-6thu`, `13-01`, `11-31`, `11-04thu`, `thanksgiving` and an empty text are rejected

### Requirement: Weekdays and extra days
A season with `days` SHALL be active only on those weekdays within its dates. A day listed in `alsoOn` SHALL be active whatever its weekday, even outside the season's dates, and a `YYYY-MM-DD` day only in that year.

#### Scenario: days, and alsoOn days outside the season or with a year
- **GIVEN** a season "weekends" from June 1 to June 30 on Saturday and Sunday, also on `07-04` and `2026-08-15`
- **WHEN** the scheduler picks the season in 2026
- **THEN** it is active on Sat June 6 and Sun June 7 but not Mon June 8
- **AND** it is active on July 4 and Aug 15, 2026, but not on Aug 15, 2027

### Requirement: Wrapping the new year and overlapping seasons
A season whose last day comes before its first SHALL run across the new year. When seasons overlap, the first one listed SHALL win.

#### Scenario: a season can wrap the new year, and the first listed wins on overlap
- **GIVEN** a season "winter" from Dec 15 to Jan 6, listed before "christmas" from Dec 1 to Dec 31
- **WHEN** the scheduler picks the season
- **THEN** it picks christmas on Dec 10, winter on Dec 20 and Jan 6, and none on Jan 7

### Requirement: Bad season entries
A season entry with a bad name, day, weekday or `alsoOn` SHALL be skipped and logged with what is wrong, and the valid entries SHALL still be used.

#### Scenario: bad season entries are skipped and logged
- **GIVEN** nine season entries where only "ok" (Feb 29 to Mar 1) is valid, and the others have a non-existent day, a `/` in the name, a hidden name, a badly written day, an unknown weekday, an empty weekday list, `alsoOn` that is not a list, and a bad `alsoOn` day
- **WHEN** the scheduler validates them
- **THEN** only "ok" is kept
- **AND** eight lines are logged, one of them `bad alsoOn day "11-4thux"`
