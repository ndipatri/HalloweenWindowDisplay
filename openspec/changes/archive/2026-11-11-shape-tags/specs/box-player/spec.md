## MODIFIED Requirements

### Requirement: Plays only items the TV's shape
Of the items picked to play (by a filter's schedule or an override), the box SHALL play only those the TV's shape (portrait items while the TV is portrait, landscape ones while it is landscape); square items SHALL play either way. An item's shape SHALL be the tag `portrait` or `landscape` when it has exactly one of them, and otherwise its shape as measured after its rotation. Items that can't be measured (and have no shape tag) SHALL play only when none of the picked items is the TV's shape (and leaving one out SHALL be logged once): then the box SHALL play them all, shown whole, and log that once. A shape tag SHALL NOT change how a photo is fitted: it fills the screen only when its measured shape is the TV's.

#### Scenario: only items the TV's shape play
- **GIVEN** the uploads `00001-tall.jpg`, `00002-tall.mp4` (portrait), `00003-wide.jpg` and `00004-wide.mp4` (landscape)
- **WHEN** the box plays the tag `upload` with the TV portrait
- **THEN** only the tall photo and video are queued
- **AND** with the TV landscape, only the wide photo and video

#### Scenario: with nothing the TV's shape, everything plays, shown whole
- **GIVEN** the TV landscape and the uploads `00001-a.jpg` and `00002-b.mp4`, both portrait
- **WHEN** the box plays the tag `upload` for a while
- **THEN** both are queued, the photo with `panscan=0`
- **AND** the box logs `Nothing in #upload is landscape, so it all plays, shown whole.` once

#### Scenario: an item that can't be measured plays only when nothing matches the TV
- **GIVEN** the TV portrait and the uploads `00001-broken.jpg` (not measurable) and `00002-wide.jpg` (landscape)
- **WHEN** the box plays the tag `upload`
- **THEN** both are queued, and the box logs `Nothing in #upload is portrait, so it all plays, shown whole.`

#### Scenario: a shape tag decides which way an item plays
- **GIVEN** the uploads `00001-tall.jpg`, `00002-wide.mp4` tagged `portrait`, and `00003-wide.jpg`
- **WHEN** the box plays the tag `upload` with the TV portrait
- **THEN** the tall photo and the wide video are queued, the video with `panscan=0`
- **AND** with the TV landscape, only the wide photo

#### Scenario: a photo tagged with the other shape is shown whole
- **GIVEN** the TV portrait and the uploads `00001-wide.jpg` tagged `portrait` and `00002-tall.jpg`
- **WHEN** the box plays the tag `upload`
- **THEN** the wide photo is queued with `panscan=0` and the tall one with `panscan=1.0`

#### Scenario: an item tagged both portrait and landscape keeps its measured shape
- **GIVEN** the TV portrait and the uploads `00001-tall.jpg` and `00002-wide.jpg` tagged both `portrait` and `landscape`
- **WHEN** the box plays the tag `upload`
- **THEN** only the tall photo is queued
