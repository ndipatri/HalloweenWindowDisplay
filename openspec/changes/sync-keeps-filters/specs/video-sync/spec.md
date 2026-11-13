## MODIFIED Requirements

### Requirement: Brings the GitHub filters
Sync SHALL copy the repo's `playlists/filters.json` to `~/video-scheduler/github-filters.json` when it differs, never leaving a half-written copy, and log it. When the repo has no `playlists/filters.json`, sync SHALL remove the box's copy and log it; but when the repo folder is missing or isn't a git checkout, it SHALL keep the box's copy and log that instead. It SHALL never touch `filters.json`, the box's custom filters.

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

#### Scenario: sync keeps the GitHub filters when the repo isn't there
- **GIVEN** a box with `github-filters.json` and videos, and sync pointed at a repo folder that doesn't exist, or at a folder that isn't a git checkout
- **WHEN** sync runs
- **THEN** `github-filters.json` and the box's videos are unchanged
- **AND** the log says `Keeping the GitHub filters: <repo> isn't a git checkout.`
