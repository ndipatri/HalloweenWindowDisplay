# Spec Delta

## Purpose

Decides what plays while Photos is chosen: the person's uploads, photos and videos together in the order they were added, whatever the season, and black with a plain explanation when there are none.

## ADDED Requirements

### Requirement: Photos plays the uploads whatever the season
An override for `photos` SHALL play the `photos/` folder as it is, on any day, with or without a season and with or without seasons configured, and the status SHALL read `photos` followed by the override's length.

#### Scenario: Photos plays the uploads on a season day
- **GIVEN** an override for `photos` until cleared, on Oct 20, 2026
- **WHEN** the scheduler decides what to show at 6 PM
- **THEN** `photos` plays, from the `photos` folder only
- **AND** the status is `photos (override until cleared)`

#### Scenario: Photos plays the uploads on a day with no season
- **GIVEN** an override for `photos` until cleared, set on Jan 15, 2026
- **WHEN** the scheduler decides what to show at 6 PM
- **THEN** `photos` plays
- **AND** the status is `photos (override until cleared)`

#### Scenario: Photos plays the uploads when there are no seasons
- **GIVEN** no seasons, and an override for `photos` until cleared on Feb 1, 2026
- **WHEN** the scheduler decides what to show at 6 PM
- **THEN** `photos` plays, from the `photos` folder

### Requirement: Uploads play in the order they were added
While Photos plays, its photos (`.jpg`, `.jpeg`, `.png`) and videos SHALL play together, sorted by file name with numbers sorted as numbers, which is upload order, round and round, leaving out hidden files and anything else. Photo files SHALL play only in Photos, never in a season.

#### Scenario: Photos plays photos and videos in upload order, round and round
- **GIVEN** a `photos` folder with `00002-b.mp4`, `00001-a.jpg`, `00010-c.png`, `notes.txt` and `.upload-123`
- **WHEN** `photos` plays six items
- **THEN** they are `00001-a.jpg`, `00002-b.mp4`, `00010-c.png`, then the same three again

#### Scenario: a photo in a season folder doesn't play
- **GIVEN** a `halloween` folder with `fuzzy.mp4` and `poster.jpg`
- **WHEN** `halloween/kid` plays
- **THEN** only fuzzy plays, round and round

### Requirement: No uploads shows black
When Photos is chosen and there are no uploads, or no `photos/` folder, the screen SHALL be black and the box SHALL log once, not as an error, that nothing has been uploaded yet.

#### Scenario: Photos with no uploads shows black and says so once
- **GIVEN** an empty `photos` folder
- **WHEN** `photos` tries to play twice
- **THEN** nothing plays
- **AND** `No photos or videos uploaded yet. Showing black until one is added.` is logged once, and no error is logged

#### Scenario: Photos with no photos folder shows black and says so once
- **GIVEN** no `photos` folder
- **WHEN** `photos` tries to play twice
- **THEN** nothing plays
- **AND** `No photos or videos uploaded yet. Showing black until one is added.` is logged once, and no error is logged

### Requirement: A removed upload leaves the screen cleanly
When an upload is removed through the website while Photos plays, the box SHALL take it out of mpv's playlist before the file is deleted, moving on to the next upload if it was showing, and SHALL log no error for it.

#### Scenario: removing the upload on screen moves on to the next
- **GIVEN** Photos playing `00001-a.jpg`, with `00002-b.mp4` and `00003-c.png` queued
- **WHEN** `00001-a.jpg` is removed through the website
- **THEN** mpv's playlist starts with `photos/00002-b.mp4`, playing, and no longer holds `00001-a.jpg`
- **AND** no `ERROR:` line is logged

#### Scenario: removing a queued upload takes it out of the queue
- **GIVEN** Photos playing `00001-a.jpg`, with `00002-b.mp4` and `00003-c.png` queued
- **WHEN** `00002-b.mp4` is removed through the website
- **THEN** `photos/00001-a.jpg` is still playing, and mpv's playlist no longer holds `00002-b.mp4`
- **AND** no `ERROR:` line is logged
