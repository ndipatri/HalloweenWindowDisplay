## ADDED Requirements

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
The box SHALL turn a visitor's name into a tag: accents dropped, lowercase, every run of other characters a dash, at most 30 characters. It SHALL refuse a name that is empty, that leaves no letters or digits, or whose tag the box already uses for something else (`upload`, `portrait`, `landscape`, `square`, or a GitHub folder's tag), saying why. The same name SHALL give the same tag, so a returning visitor adds to theirs.

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

#### Scenario: a returning visitor adds to their tag
- **GIVEN** an upload already tagged `aunt-sue`
- **WHEN** `Aunt Sue` adds two more
- **THEN** all three are tagged `aunt-sue`

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
When the visitor taps **Put them on the TV**, the page SHALL need a name and at least one file, and no PIN, SHALL send the files, and only when every file was added SHALL play the visitor's tag, and only that tag, until someone changes it, saying so.

#### Scenario: the visitor's pictures play until changed
- **GIVEN** the easy page with the name `Aunt Sue` and two photos picked
- **WHEN** **Put them on the TV** is tapped
- **THEN** both are sent with the tag `aunt-sue`, then the box is asked to play `aunt-sue` until cleared
- **AND** the page says `Done! Your pictures are on the TV now.`

#### Scenario: nothing plays when an upload is refused
- **GIVEN** the easy page with two photos picked, and a box that refuses the first as too big
- **WHEN** **Put them on the TV** is tapped
- **THEN** the page says why, and sends no more
- **AND** nothing is played

#### Scenario: the easy page needs a name and a file
- **WHEN** **Put them on the TV** is tapped with no name or no files
- **THEN** the page says `Type your name first.` or `Choose some photos or videos first.`
- **AND** nothing is sent
