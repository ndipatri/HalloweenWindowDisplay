# Spec Delta

## ADDED Requirements

### Requirement: The picks name is kept for My picks
A season named `picks` SHALL be skipped and logged as an error naming the reason, because that name is My picks' own choice.

#### Scenario: a season named picks is skipped and logged
- **GIVEN** seasons `picks` from 06-01 to 06-30, then `halloween` from 10-01 to 10-31
- **WHEN** the scheduler reads them
- **THEN** only `halloween` is kept
- **AND** `ERROR: Ignoring season entry 1` is logged, saying the name `picks` is kept for My picks
