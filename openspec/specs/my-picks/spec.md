# my-picks Specification

## Purpose
Lets the person choose any of the videos already on the box and any of their uploads, keeps that choice in order on the box, and plays it round and round while My picks is chosen on the website.

## Requirements

### Requirement: The website lists what can be picked
The website SHALL list every video in the season folders and their playlist subfolders (never a photo file there), then every upload, photos and videos, each with its path and the group it comes from, and the saved picks in their order, leaving out any pick that is no longer on the box.

#### Scenario: the website lists what can be picked
- **GIVEN** folders `halloween` with `fuzzy.mp4` and `poster.jpg`, `halloween/grownup` with `jump.mp4`, `thanksgiving` with `dusk.mp4`, and `photos` with `00001-a.jpg` and `00002-b.mov`
- **AND** a picks file holding `thanksgiving/dusk.mp4` then `photos/00001-a.jpg`
- **WHEN** the website is asked for the picks
- **THEN** the items are `halloween/fuzzy.mp4` (Halloween), `halloween/grownup/jump.mp4` (Halloween / Grownup), `thanksgiving/dusk.mp4` (Thanksgiving), `photos/00001-a.jpg` and `photos/00002-b.mov` (Uploads), in that order
- **AND** the picks are `thanksgiving/dusk.mp4` then `photos/00001-a.jpg`

#### Scenario: the website leaves out a pick that is no longer on the box
- **GIVEN** a `thanksgiving` folder with `dusk.mp4`, and a picks file holding `halloween/gone.mp4` then `thanksgiving/dusk.mp4`
- **WHEN** the website is asked for the picks
- **THEN** the picks are just `thanksgiving/dusk.mp4`

### Requirement: The website saves the picks
The website SHALL save the picks it is given, in that order and each only once, to `picks.json` in the video folder, answer with how many are picked, and log it. It SHALL refuse, saving nothing, a list that names anything that can't be picked.

#### Scenario: the website saves the picks in the order given
- **GIVEN** folders `halloween` with `fuzzy.mp4`, `thanksgiving` with `dusk.mp4`, and `photos` with `00001-a.jpg`
- **WHEN** the website is asked to save the picks `photos/00001-a.jpg`, `thanksgiving/dusk.mp4`
- **THEN** the picks file holds `photos/00001-a.jpg` then `thanksgiving/dusk.mp4`
- **AND** the website answers `Saved. 2 picked.`
- **AND** the log says `My picks: 2 picked (from the website).`

#### Scenario: the website saves each pick only once
- **GIVEN** folders `halloween` with `fuzzy.mp4` and `thanksgiving` with `dusk.mp4`
- **WHEN** the website is asked to save the picks `thanksgiving/dusk.mp4`, `halloween/fuzzy.mp4`, `thanksgiving/dusk.mp4`
- **THEN** the picks file holds `thanksgiving/dusk.mp4` then `halloween/fuzzy.mp4`
- **AND** the website answers `Saved. 2 picked.`

#### Scenario: the website saves an empty list of picks
- **GIVEN** a picks file holding `thanksgiving/dusk.mp4`
- **WHEN** the website is asked to save no picks
- **THEN** the picks file holds no picks
- **AND** the website answers `Saved. Nothing picked.`

#### Scenario: the website refuses a pick that can't be picked
- **GIVEN** a `halloween` folder with `fuzzy.mp4` and `poster.jpg`, the status file, and a picks file holding `halloween/fuzzy.mp4`
- **WHEN** the website is asked four times to save picks: just `../status`, just `halloween/poster.jpg`, just `halloween/missing.mp4`, and just `photos/.upload-1`
- **THEN** each request is refused with `Can't pick` and the name
- **AND** the picks file still holds just `halloween/fuzzy.mp4`

### Requirement: My picks is chosen whole
The website SHALL refuse to show anything inside `picks/`, writing no override, because My picks plays the picked items, not a folder.

#### Scenario: the website won't show a folder inside picks
- **GIVEN** folders `picks` and `picks/old`, and no override file
- **WHEN** the website is asked to show `picks/old`
- **THEN** the request is refused with `Not a playlist name`
- **AND** no override file is written

### Requirement: My picks plays the picks in order, round and round
An override for `picks` SHALL play the picked items in the order they were picked, round and round, on any day, with or without a season, photos shown like uploads, and the status SHALL read `picks` followed by the override's length.

#### Scenario: My picks plays the picks in the order they were picked, round and round
- **GIVEN** folders `halloween` with `fuzzy.mp4`, `thanksgiving` with `dusk.mp4`, and `photos` with `00001-a.jpg`
- **AND** a picks file holding `thanksgiving/dusk.mp4`, `photos/00001-a.jpg`, `halloween/fuzzy.mp4`
- **WHEN** `picks` plays six items
- **THEN** they are `thanksgiving/dusk.mp4`, `photos/00001-a.jpg`, `halloween/fuzzy.mp4`, then the same three again

#### Scenario: a single pick plays round and round
- **GIVEN** a `thanksgiving` folder with `dusk.mp4` and `fall.mp4`, and a picks file holding just `thanksgiving/dusk.mp4`
- **WHEN** `picks` plays three items
- **THEN** each is `thanksgiving/dusk.mp4`

#### Scenario: My picks plays on a day with no season
- **GIVEN** an override for `picks` until cleared, set on Jan 15, 2026
- **WHEN** the scheduler decides what to show at 6 PM
- **THEN** `picks` plays
- **AND** the status is `picks (override until cleared)`

### Requirement: Nothing picked shows black
When My picks is chosen and nothing is picked, or there is no picks file, the screen SHALL be black and the box SHALL log once, not as an error, that nothing is picked yet.

#### Scenario: My picks with nothing picked shows black and says so once
- **GIVEN** no picks file
- **WHEN** `picks` tries to play twice
- **THEN** nothing plays
- **AND** `Nothing picked yet. Showing black until something is ticked in My picks.` is logged once, and no error is logged

### Requirement: A pick no longer on the box is skipped
A pick whose file is no longer on the box SHALL be skipped, logged once, not as an error, and the other picks SHALL play.

#### Scenario: My picks skips a pick that is no longer on the box and says so once
- **GIVEN** a `thanksgiving` folder with `dusk.mp4`, and a picks file holding `halloween/gone.mp4` then `thanksgiving/dusk.mp4`
- **WHEN** `picks` plays four items
- **THEN** each is `thanksgiving/dusk.mp4`
- **AND** `Skipping halloween/gone.mp4 in picks: it is no longer on the box.` is logged once, and no error is logged

### Requirement: Changing the picks while they play
When the picks are saved while My picks plays, the box SHALL replace what is queued behind the item on screen with the new picks, continuing after that item; if that item is no longer picked, it SHALL move on at once, without going black, to the first pick that came after it, or else the first pick, logging no error.

#### Scenario: changing the picks while they play replaces what is queued
- **GIVEN** My picks playing `thanksgiving/dusk.mp4`, with `photos/00001-a.jpg` and `halloween/fuzzy.mp4` queued
- **WHEN** the picks are saved as `thanksgiving/dusk.mp4`, `halloween/grownup/jump.mp4`
- **THEN** mpv's playlist is `thanksgiving/dusk.mp4`, playing, then `halloween/grownup/jump.mp4`, `thanksgiving/dusk.mp4`

#### Scenario: unpicking the item on screen moves on to the next pick
- **GIVEN** My picks playing `thanksgiving/dusk.mp4`, with `photos/00001-a.jpg` and `halloween/fuzzy.mp4` queued
- **WHEN** the picks are saved as `halloween/fuzzy.mp4`, `photos/00001-a.jpg`
- **THEN** mpv's playlist is `photos/00001-a.jpg`, playing, then `halloween/fuzzy.mp4`, `photos/00001-a.jpg`
- **AND** no `ERROR:` line is logged

### Requirement: The page picks and plays
The page SHALL offer a My picks section listing every item from the website's list under its group, each with a tick box, the picked ones ticked and numbered in pick order, and SHALL save the picks whenever one is ticked or unticked: a ticked item goes to the end, and an unticked one comes out with the numbers after it closing up. It SHALL say at the top of the section that each tick is saved straight away, and under the list, in view while the list scrolls, SHALL confirm each save there with how many are picked and what to do next, and offer a Play my picks button that answers there when tapped.

#### Scenario: the website page offers My picks
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a My picks section that shows each item from the website's picks list under its group, with a tick box, and the picked ones numbered in order
- **AND** a tick or untick saves the picks

#### Scenario: the page puts a ticked item at the end of the picks and closes up an unticked one
- **GIVEN** the page with the picks `thanksgiving/dusk.mp4`, `photos/00001-a.jpg`, `halloween/fuzzy.mp4`
- **WHEN** the person ticks `halloween/grownup/jump.mp4`, then unticks `photos/00001-a.jpg`
- **THEN** the picks saved are first `thanksgiving/dusk.mp4`, `photos/00001-a.jpg`, `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4`, then `thanksgiving/dusk.mp4`, `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4`

#### Scenario: the page confirms the picks next to the list and offers Play my picks
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** the My picks section says `Each tick is saved straight away.`
- **AND** under the list it shows `Saving…` while a tick is saved, then `✓ Saved.` with how many are picked and `Tap Play my picks to show them.`, or `Showing on the window now.` while My picks is on, or `Nothing picked yet.`
- **AND** it has a Play my picks button there that shows `picks` for the chosen duration, reading `Starting…` while it does, after which the note says `▶ Playing your picks` and until when
