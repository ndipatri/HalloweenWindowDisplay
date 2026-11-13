# visitor-page Specification

## Purpose
Gives someone at the TV, who scanned the QR code on the TV, one simple page to put their own photos and videos on the TV under their name: their name becomes a tag, a new visit replaces their earlier pictures, each picked file shows its shape with a warning when none fit the way the TV faces, and their tag then plays until someone changes it.

## Requirements

### Requirement: The easy page is the box's front page
The website SHALL serve, at `/`, an easy page for visitors with a field for their name, a picker for photos and videos, a **Put them on the TV** button, and a link to the advanced page at `/advanced`. The QR code on the TV SHALL open this page.

#### Scenario: the easy page is at the box's address
- **WHEN** a phone opens `/`
- **THEN** it gets the easy page, with the name field, the photo and video picker, no PIN field, **Put them on the TV**, and a link to `/advanced`

#### Scenario: the address code opens the easy page
- **GIVEN** the box at 10.0.0.25
- **WHEN** the address code is made
- **THEN** it is of `http://10.0.0.25/`, which serves the easy page

### Requirement: A visitor's name becomes their tag
The box SHALL turn a visitor's name into a tag: accents dropped, lowercase, every run of other characters a dash, at most 30 characters. It SHALL refuse a name that is empty, that leaves no letters or digits, or whose tag the box already uses for something else (`upload`, `portrait`, `landscape`, `square`, or a GitHub folder's tag), saying why. The same name SHALL give the same tag.

#### Scenario: a visitor's name becomes their tag
- **GIVEN** the website running
- **WHEN** the batch is checked with the names `Aunt Sue`, `José María` and a 40-letter name
- **THEN** the tags are `aunt-sue`, `jose-maria` and the first 30 letters

#### Scenario: a name the box uses is refused
- **GIVEN** a GitHub folder tagged `halloween`
- **WHEN** the batch is checked with the name `Halloween`, `Upload` or `portrait`
- **THEN** it is refused with `That name is taken by the box. Try adding your last name.`

#### Scenario: a name with no letters or numbers is refused
- **WHEN** the batch is checked with the name `   ` or `!!!`
- **THEN** it is refused with `Type your name first.` or `Use some letters or numbers in your name.`

### Requirement: Visitor uploads are tagged with their name
An upload sent with a visitor tag SHALL need no PIN, like any upload, SHALL be refused before anything is saved when the tag isn't one a visitor's name can give, and once saved SHALL carry the tag, logged with the upload.

#### Scenario: each visitor upload is tagged with their name
- **GIVEN** no uploads
- **WHEN** `Beach.JPG`, 2 MB, is sent with the tag `aunt-sue`
- **THEN** `photos/00001-beach.jpg` is saved and tagged `aunt-sue`
- **AND** the log says `Uploaded photos/00001-beach.jpg (2.0 MB) for aunt-sue`

#### Scenario: a visitor upload with a tag the box uses is refused
- **GIVEN** a GitHub folder tagged `halloween`
- **WHEN** `Beach.JPG` is sent with the tag `halloween`
- **THEN** it is refused with `That name is taken by the box. Try adding your last name.`
- **AND** nothing is saved

### Requirement: Put them on the TV plays the visitor's pictures
When the visitor taps **Put them on the TV**, the page SHALL need a name and at least one file, and no PIN, and SHALL send the files. Only when every file was added SHALL the box delete every other upload with the visitor's tag (from an earlier visit under the same name), so that only this batch is left under it, and play that tag, and only that tag, until someone changes it, saying so.

#### Scenario: the visitor's pictures play until changed
- **GIVEN** the easy page with the name `Aunt Sue` and two photos picked
- **WHEN** **Put them on the TV** is tapped
- **THEN** both are sent with the tag `aunt-sue`, then the box is asked to keep just those two under `aunt-sue` and play it until cleared
- **AND** the page says `Done! Your pictures are on the TV now.`

#### Scenario: a returning visitor's old pictures are replaced
- **GIVEN** `photos/00001-old.jpg` tagged `aunt-sue` (and `favorites`), and `photos/00002-other.jpg` tagged `bob`
- **WHEN** `Aunt Sue` adds `new.jpg` and `new2.jpg`, and the box is asked to keep just those under `aunt-sue`
- **THEN** `photos/00001-old.jpg` is deleted, and its tags with it, logged `Removed photos/00001-old.jpg (aunt-sue added new pictures)`
- **AND** `photos/00003-new.jpg`, `photos/00004-new2.jpg` and `photos/00002-other.jpg` are still there, and only the two new ones play, until cleared

#### Scenario: the box keeps only a visitor's own new pictures
- **GIVEN** `photos/00001-a.jpg` tagged `aunt-sue`, and `photos/00002-b.jpg` tagged `bob`
- **WHEN** the box is asked to keep, under `aunt-sue`, `00002-b.jpg`, or nothing, or `missing.jpg`, or to keep under `halloween`
- **THEN** each is refused, and nothing is deleted or played

#### Scenario: nothing plays when an upload is refused
- **GIVEN** the easy page with two photos picked, and a box that refuses the first as too big
- **WHEN** **Put them on the TV** is tapped
- **THEN** the page says why, and sends no more
- **AND** nothing is played, and no earlier pictures are deleted

#### Scenario: the easy page needs a name and a file
- **WHEN** **Put them on the TV** is tapped with no name or no files
- **THEN** the page says `Type your name first.` or `Choose some photos or videos first.`
- **AND** nothing is sent

### Requirement: The easy page shows each picked file's shape and warns when none fit the TV
When files are picked on the easy page, it SHALL show each as a thumbnail labeled with its shape (portrait, landscape or square, measured as the box does), and, when every measured file is the other shape from the way the TV faces, SHALL warn before sending and say so again when done. A mix, or a square or matching file, SHALL show no warning.

#### Scenario: the easy page shows each picked file with its shape
- **GIVEN** the easy page
- **WHEN** the visitor picks a photo 3000×4000, a photo 4080×3072, a video 1080×1080 and a file it can't measure
- **THEN** each shows as a thumbnail, labeled Portrait, Landscape, Square and nothing

#### Scenario: the easy page warns when no picked file fits the TV
- **GIVEN** the TV portrait
- **WHEN** every picked file is landscape
- **THEN** the page says `The TV is portrait, so landscape pictures won't show until it's turned.`
- **AND** with the TV landscape and every file portrait, it says `The TV is landscape, so portrait pictures won't show until it's turned.`
- **AND** with a mix, a square file, or files that fit, it says nothing

#### Scenario: done says the pictures won't show until the TV is turned
- **GIVEN** the easy page warning that the TV is portrait
- **WHEN** the pictures are sent and played
- **THEN** the page says `Done! They're on the box, but the TV is portrait, so they won't show until it's turned.`
