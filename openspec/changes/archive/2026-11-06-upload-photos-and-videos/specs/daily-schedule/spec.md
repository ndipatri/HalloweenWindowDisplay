# Spec Delta

## ADDED Requirements

### Requirement: The schedule never plays uploads
A schedule period whose playlist is `photos` SHALL be skipped and logged as an error naming the reason, because uploads play only when chosen on the website.

#### Scenario: a schedule entry for photos is skipped and logged
- **GIVEN** a schedule of kid from 17:00 to 19:30, then photos from 19:30 to 23:00
- **WHEN** the scheduler reads it
- **THEN** only the kid period is kept
- **AND** `ERROR: Ignoring schedule entry 2` is logged, saying `photos` plays only when chosen on the website
