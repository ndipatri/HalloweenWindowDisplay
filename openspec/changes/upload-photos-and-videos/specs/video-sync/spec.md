# Spec Delta

## ADDED Requirements

### Requirement: Leaves the uploads alone
Sync SHALL never copy into, move out of, or set aside anything in the box's `photos/` folder or its subfolders, even when the repo has a `playlists/photos/` folder, and SHALL log once per sync that it skipped that folder.

#### Scenario: sync skips a photos folder in the repo
- **GIVEN** the box has `photos/00001-a.jpg` and `photos/old/x.mp4`, and the repo has `playlists/photos/y.mp4` and `playlists/photos/old/z.mp4`
- **WHEN** sync runs
- **THEN** the box's `photos/` holds exactly `00001-a.jpg` and `old/x.mp4`, unchanged, and nothing is moved to `.removed/photos`
- **AND** the log says `Skipping playlists/photos: that name is kept for uploads from the website.` once
