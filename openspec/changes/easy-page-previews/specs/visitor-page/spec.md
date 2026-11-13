## ADDED Requirements

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
