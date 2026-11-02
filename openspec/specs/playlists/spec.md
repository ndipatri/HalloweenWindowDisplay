# playlists Specification

## Purpose
Decides which video folders a playlist plays and in what order, so a season's own videos and its playlist's videos play together and missing or empty folders show black instead of failing.

## Requirements

### Requirement: Playlist names resolve to today's season
A plain playlist name SHALL resolve to that playlist within today's season, or to nothing on a day with no season. A name that starts with a season SHALL be used as it is.

#### Scenario: a playlist name resolves to today's season
- **GIVEN** the shipped seasons
- **WHEN** the scheduler resolves playlist names
- **THEN** `kid` on Oct 20 is `halloween/kid`, `grownup` on Dec 5 is `christmas/grownup`, and `kid` on Feb 1 is nothing
- **AND** `christmas` and `christmas/kid` on Oct 20 stay `christmas` and `christmas/kid`, and no name is nothing

### Requirement: A season playlist plays two folders
A season playlist SHALL play the season's own folder plus its subfolder named after the playlist. A season on its own SHALL play just its folder.

#### Scenario: a season playlist plays the season folder plus its subfolder
- **GIVEN** the shipped seasons
- **WHEN** the scheduler lists the folders for `halloween/grownup` and for `christmas`
- **THEN** they are `halloween` and `halloween/grownup`, and just `christmas`

### Requirement: Playlists without seasons
With no seasons configured, a playlist SHALL be a folder directly in the video folder and SHALL play all year.

#### Scenario: without seasons, playlists are folders in videoRoot all year
- **GIVEN** no seasons
- **WHEN** the scheduler resolves `kid` on Feb 1 and lists its folders
- **THEN** it is `kid`, played from the `kid` folder

#### Scenario: without seasons, a playlist folder plays as before
- **GIVEN** no seasons, and a `kid` folder holding `2-b.mp4`, `10-c.mp4` and `1-a.mp4`
- **WHEN** the kid playlist plays
- **THEN** the videos play as `1-a.mp4`, `2-b.mp4`, `10-c.mp4`, with numbers sorted as numbers

### Requirement: Play order
The videos of a playlist's folders SHALL play together, sorted by file name with numbers sorted as numbers, round and round. Only `.mp4`, `.m4v` and `.mov` files SHALL play, and the same file name in two folders SHALL play both copies.

#### Scenario: season videos and subfolder videos play together, in name order, round and round
- **GIVEN** a `halloween` folder with `fuzzy.mp4`, `mochi.mp4`, `notes.txt`, `.DS_Store` and a `grownup` subfolder with `jump.mp4` and `lady.mp4`
- **WHEN** `halloween/grownup` plays eight videos
- **THEN** they are fuzzy, grownup/jump, grownup/lady, mochi, then the same four again

#### Scenario: a season without the playlist subfolder plays just its own videos
- **GIVEN** a `halloween` folder with `fuzzy.mp4` and `mochi.mp4`, and no `kid` subfolder
- **WHEN** `halloween/kid` plays
- **THEN** fuzzy and mochi play, round and round
- **AND** no error is logged

#### Scenario: the same file name in both folders plays both copies
- **GIVEN** `a.mp4` in both `halloween` and `halloween/kid`
- **WHEN** `halloween/kid` plays
- **THEN** `halloween/a.mp4` and then `halloween/kid/a.mp4` play, round and round

### Requirement: Missing or empty folders show black
When a playlist's season folder is missing, or it and its subfolder hold no videos, the screen SHALL be black and the problem SHALL be logged once, not as an error.

#### Scenario: a missing season folder is reported once (not as an error) and shows black
- **GIVEN** no `thanksgiving` folder
- **WHEN** `thanksgiving/kid` tries to play twice
- **THEN** nothing plays
- **AND** `No folder … thanksgiving, so showing black` is logged once, and no error is logged

#### Scenario: an empty season is reported once and shows black
- **GIVEN** an empty `thanksgiving` folder
- **WHEN** `thanksgiving/kid` tries to play twice
- **THEN** nothing plays
- **AND** `No videos for thanksgiving/kid` is logged once
