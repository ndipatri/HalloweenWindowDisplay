# Spec Delta

## MODIFIED Requirements

### Requirement: Syncs on request
The website SHALL start a sync when asked, the same sync the hourly timer runs, and SHALL answer at once. While a sync it started is still running, it SHALL not start another, and SHALL say so.

#### Scenario: the website starts a sync when asked
- **GIVEN** no sync running
- **WHEN** the website is asked to sync
- **THEN** it starts one sync
- **AND** it answers `Checking GitHub for new videos. New ones play within a minute or two; watch Recent activity below.`

#### Scenario: the website doesn't start a second sync while one is running
- **GIVEN** a sync the website started is still running
- **WHEN** the website is asked to sync again
- **THEN** it starts no other sync
- **AND** it answers `Already checking for new videos.`

## REMOVED Requirements

### Requirement: Shows recent activity
**Reason**: Its page scenario named the old Sync now button; replaced by "Shows recent activity and offers new videos", with that scenario renamed.
**Migration**: See "Shows recent activity and offers new videos" below.

## ADDED Requirements

### Requirement: Shows recent activity and offers new videos
The website SHALL show the last 20 lines of the box's log, oldest first, and no lines when there is no log yet. Its page SHALL offer to check for new videos now, in a section saying what that does, and show the recent activity, refreshed every few seconds.

#### Scenario: the website shows the last lines of the log
- **GIVEN** the log has 30 lines, `line 1` to `line 30`
- **WHEN** the website is asked for the recent activity
- **THEN** it answers with `line 11` to `line 30`, in that order

#### Scenario: the website shows no log lines when there is no log yet
- **GIVEN** no log file
- **WHEN** the website is asked for the recent activity
- **THEN** it answers with no lines

#### Scenario: the website page offers checking for new videos and shows recent activity
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a New videos from GitHub section saying `The box checks GitHub for new videos every hour by itself.`, with a Check for new videos now button that starts a sync and shows the website's answer just under it
- **AND** it has a Recent activity list filled from the website's recent activity
