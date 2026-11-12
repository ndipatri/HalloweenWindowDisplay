## ADDED Requirements

### Requirement: Says each upload's measured shape
The website SHALL give, with each upload in its list of items, the shape the box measures for it (`portrait`, `landscape` or `square`, after its rotation), or none when it can't be measured, whatever its tags.

#### Scenario: the website says each upload's measured shape
- **GIVEN** the uploads `00001-tall.jpg`, `00002-wide.mp4` tagged `portrait`, `00003-square.png` and `00004-broken.jpg` (not measurable)
- **WHEN** the website is asked for the items
- **THEN** their shapes are `portrait`, `landscape`, `square` and none
