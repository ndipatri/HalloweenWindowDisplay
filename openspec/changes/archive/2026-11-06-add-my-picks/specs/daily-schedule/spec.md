# Spec Delta

## ADDED Requirements

### Requirement: The schedule never plays the picks
A schedule period whose playlist is `picks` SHALL be skipped and logged as an error naming the reason, because My picks plays only when chosen on the website.

#### Scenario: a schedule entry for picks is skipped and logged
- **GIVEN** a schedule of kid from 17:00 to 19:30, then picks from 19:30 to 23:00
- **WHEN** the scheduler reads it
- **THEN** only the kid period is kept
- **AND** `ERROR: Ignoring schedule entry 2` is logged, saying `picks` plays only when chosen on the website
