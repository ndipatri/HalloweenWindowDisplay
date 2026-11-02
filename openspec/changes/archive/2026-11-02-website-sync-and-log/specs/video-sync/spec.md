## ADDED Requirements

### Requirement: One sync at a time
A sync that starts while another is running SHALL log that it skipped and stop, without pulling or copying, so two syncs never write the same video at once.

#### Scenario: a sync that starts while another is running skips
- **GIVEN** a sync is running, and the repo has `playlists/halloween/a.mp4` that the box doesn't have yet
- **WHEN** a second sync starts
- **THEN** it logs `Skipped: another sync is already running.` and finishes with success
- **AND** it copies nothing: the box still has no `halloween/a.mp4`
