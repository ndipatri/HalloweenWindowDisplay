# Spec Delta

## ADDED Requirements

### Requirement: The photos name is kept for uploads
A season named `photos` SHALL be skipped and logged as an error naming the reason, because that name is the uploads' own choice.

#### Scenario: a season named photos is skipped and logged
- **GIVEN** seasons `photos` from 06-01 to 06-30, then `halloween` from 10-01 to 10-31
- **WHEN** the scheduler reads them
- **THEN** only `halloween` is kept
- **AND** `ERROR: Ignoring season entry 1` is logged, saying the name `photos` is kept for uploads
