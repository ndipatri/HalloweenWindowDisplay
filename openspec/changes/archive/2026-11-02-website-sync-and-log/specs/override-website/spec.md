## ADDED Requirements

### Requirement: Syncs on request
The website SHALL start a sync when asked, the same sync the hourly timer runs, and SHALL answer at once. While a sync it started is still running, it SHALL not start another, and SHALL say so.

#### Scenario: the website starts a sync when asked
- **GIVEN** no sync running
- **WHEN** the website is asked to sync
- **THEN** it starts one sync
- **AND** it answers `Syncing now. New videos play within a minute or two.`

#### Scenario: the website doesn't start a second sync while one is running
- **GIVEN** a sync the website started is still running
- **WHEN** the website is asked to sync again
- **THEN** it starts no other sync
- **AND** it answers `A sync is already running.`

### Requirement: Shows recent activity
The website SHALL show the last 20 lines of the box's log, oldest first, and no lines when there is no log yet. Its page SHALL offer Sync now and show the recent activity, refreshed every few seconds.

#### Scenario: the website shows the last lines of the log
- **GIVEN** the log has 30 lines, `line 1` to `line 30`
- **WHEN** the website is asked for the recent activity
- **THEN** it answers with `line 11` to `line 30`, in that order

#### Scenario: the website shows no log lines when there is no log yet
- **GIVEN** no log file
- **WHEN** the website is asked for the recent activity
- **THEN** it answers with no lines

#### Scenario: the website page offers Sync now and shows recent activity
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a Sync now button and a Recent activity list filled from the website's recent activity
