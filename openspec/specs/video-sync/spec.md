# video-sync Specification

## Purpose
Keeps the box's video folder the same as the repo's `playlists/`, so new videos appear and removed ones stop playing, without ever deleting a video or showing a half-copied one.

## Requirements

### Requirement: Pulls from GitHub first
Sync SHALL pull the repo from GitHub before copying, and SHALL log the commit it pulled. Asked not to pull, it SHALL copy from the repo as it is.

#### Scenario: sync pulls the latest from GitHub before copying
- **GIVEN** the box's repo is one commit behind GitHub, and that commit adds `playlists/halloween/new.mp4`
- **WHEN** sync runs
- **THEN** `halloween/new.mp4` is in the box's video folder
- **AND** the log says `Pulled the latest from GitHub (<commit>)`

#### Scenario: sync without pulling copies the repo as it is
- **GIVEN** the box's repo is one commit behind GitHub, and the repo has `playlists/halloween/a.mp4`
- **WHEN** sync runs with `--no-pull`
- **THEN** `halloween/a.mp4` is in the box's video folder
- **AND** the box's repo is still one commit behind

### Requirement: Leaves nothing running
When sync finishes, nothing it started SHALL still be running or holding its output open, so whatever started it (systemd, setup, a test) sees it finish at once.

#### Scenario: sync leaves nothing running when it finishes
- **GIVEN** the repo has `playlists/halloween/a.mp4`, GitHub answers at once, and the pull time limit is the default 60 seconds
- **WHEN** sync runs with its output read to the end
- **THEN** the output ends within 10 seconds

### Requirement: Carries on without GitHub
When the pull fails, or GitHub doesn't answer within the time allowed, sync SHALL log why and copy the videos already in the repo.

#### Scenario: sync uses the videos already in the repo when GitHub can't be reached
- **GIVEN** the box's repo points to a GitHub that doesn't exist, and has `playlists/halloween/a.mp4`
- **WHEN** sync runs
- **THEN** the log says `Couldn't pull from GitHub (` with the reason, then `Using the videos already in the repo.`
- **AND** `halloween/a.mp4` is in the box's video folder

#### Scenario: sync gives up on a pull that doesn't answer in time
- **GIVEN** a pull that never finishes, a time limit of 1 second, and `playlists/halloween/a.mp4` in the repo
- **WHEN** sync runs
- **THEN** it finishes within 10 seconds
- **AND** the log says `Couldn't pull from GitHub (no answer within 1 seconds)`
- **AND** `halloween/a.mp4` is in the box's video folder

### Requirement: Copies new and changed videos
Sync SHALL copy each video that is new or changed in each folder under `playlists/`, at any depth, SHALL leave unchanged videos untouched, and SHALL copy only `.mp4`, `.m4v` and `.mov` files that aren't hidden.

#### Scenario: sync copies new videos from the repo
- **GIVEN** the repo has `playlists/halloween/a.mp4` and `playlists/halloween/grownup/b.mp4`, and the box has no videos
- **WHEN** sync runs
- **THEN** `halloween/a.mp4` and `halloween/grownup/b.mp4` are in the box's video folder, the same as in the repo
- **AND** the log says `Copied halloween/a.mp4`, `Copied halloween/grownup/b.mp4` and `Done: 2 copied, 0 moved aside.`

#### Scenario: sync replaces a video that changed in the repo
- **GIVEN** the box has `halloween/a.mp4` from an earlier sync, and the repo's `a.mp4` has since changed
- **WHEN** sync runs
- **THEN** the box's `halloween/a.mp4` is the same as the repo's
- **AND** the log says `Copied halloween/a.mp4`

#### Scenario: sync leaves a video that hasn't changed alone
- **GIVEN** the box has `halloween/a.mp4` from an earlier sync, unchanged in the repo
- **WHEN** sync runs again
- **THEN** the box's `halloween/a.mp4` is the same file as before, not rewritten
- **AND** the log says `Done: 0 copied, 0 moved aside.`

#### Scenario: sync copies only videos
- **GIVEN** the repo's `playlists/halloween/` has `a.mp4`, `b.MOV`, `c.m4v`, `notes.txt`, `.hidden.mp4` and `README`
- **WHEN** sync runs
- **THEN** the box's `halloween/` has `a.mp4`, `b.MOV` and `c.m4v`, and nothing else

#### Scenario: a video that fails to copy leaves nothing half-copied
- **GIVEN** the repo has `playlists/halloween/a.mp4`, and copying fails partway through
- **WHEN** sync runs
- **THEN** the box's `halloween/` has neither `a.mp4` nor any hidden part-copy
- **AND** the log says `ERROR: Couldn't copy halloween/a.mp4`

### Requirement: Sets removed videos aside
Sync SHALL move a video that is no longer in the repo into `.removed/<folder>/` instead of deleting it, including every video in a subfolder the repo no longer has. It SHALL leave alone top-level folders the repo doesn't have.

#### Scenario: sync moves a video no longer in the repo aside, never deleting it
- **GIVEN** the box has `halloween/a.mp4` and `halloween/old.mp4`, and the repo has only `playlists/halloween/a.mp4`
- **WHEN** sync runs
- **THEN** `halloween/old.mp4` is gone and `.removed/halloween/old.mp4` has its contents
- **AND** the log says `Moved halloween/old.mp4 to .removed/halloween/ (no longer in the repo)`

#### Scenario: sync moves aside the videos of a subfolder no longer in the repo
- **GIVEN** the box has `halloween/grownup/b.mp4`, and the repo has `playlists/halloween/a.mp4` but no `grownup` folder
- **WHEN** sync runs
- **THEN** `.removed/halloween/grownup/b.mp4` has its contents, and the box's `halloween/grownup/` has no videos
- **AND** the log says `Moved halloween/grownup/b.mp4 to .removed/halloween/grownup/ (folder no longer in the repo)`

#### Scenario: sync leaves a season folder the repo doesn't have alone
- **GIVEN** the box has `easter/egg.mp4` and `easter/kid/chick.mp4`, and the repo has no `playlists/easter`
- **WHEN** sync runs
- **THEN** `easter/egg.mp4` and `easter/kid/chick.mp4` are still in the box's video folder, unchanged
- **AND** nothing is moved to `.removed/easter`

### Requirement: One sync at a time
A sync that starts while another is running SHALL log that it skipped and stop, without pulling or copying, so two syncs never write the same video at once.

#### Scenario: a sync that starts while another is running skips
- **GIVEN** a sync is running, and the repo has `playlists/halloween/a.mp4` that the box doesn't have yet
- **WHEN** a second sync starts
- **THEN** it logs `Skipped: another sync is already running.` and finishes with success
- **AND** it copies nothing: the box still has no `halloween/a.mp4`

### Requirement: Leaves the uploads alone
Sync SHALL never copy into, move out of, or set aside anything in the box's `photos/` folder or its subfolders, even when the repo has a `playlists/photos/` folder, and SHALL log once per sync that it skipped that folder.

#### Scenario: sync skips a photos folder in the repo
- **GIVEN** the box has `photos/00001-a.jpg` and `photos/old/x.mp4`, and the repo has `playlists/photos/y.mp4` and `playlists/photos/old/z.mp4`
- **WHEN** sync runs
- **THEN** the box's `photos/` holds exactly `00001-a.jpg` and `old/x.mp4`, unchanged, and nothing is moved to `.removed/photos`
- **AND** the log says `Skipping playlists/photos: that name is kept for uploads from the website.` once

### Requirement: Brings the GitHub filters
Sync SHALL copy the repo's `playlists/filters.json` to `~/video-scheduler/github-filters.json` when it differs, never leaving a half-written copy, and log it. When the repo has no `playlists/filters.json`, sync SHALL remove the box's copy and log it. It SHALL never touch `filters.json`, the box's custom filters.

#### Scenario: sync copies the GitHub filters to the box
- **GIVEN** a repo with `playlists/filters.json`, and a box with none and with its own `filters.json`
- **WHEN** sync runs, then runs again
- **THEN** `~/video-scheduler/github-filters.json` is the same as the repo's file, and `filters.json` is unchanged
- **AND** the log says `Updated the GitHub filters.` once

#### Scenario: sync removes the GitHub filters when the repo has none
- **GIVEN** a box with `github-filters.json`, and a repo with no `playlists/filters.json`
- **WHEN** sync runs
- **THEN** `github-filters.json` is gone
- **AND** the log says `Removed the GitHub filters (the repo has none).`
