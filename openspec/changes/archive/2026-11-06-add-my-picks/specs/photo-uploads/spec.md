# Spec Delta

## ADDED Requirements

### Requirement: Uploads join and leave the picks
A new upload SHALL be added to the end of the picks, and removing an upload SHALL take it out of the picks, leaving the other picks in their order.

#### Scenario: a new upload joins the end of the picks
- **GIVEN** the upload PIN `4321`, a `thanksgiving` folder with `dusk.mp4`, and a picks file holding `thanksgiving/dusk.mp4`
- **WHEN** `a.jpg` is uploaded with PIN `4321`
- **THEN** the picks file holds `thanksgiving/dusk.mp4` then `photos/00001-a.jpg`

#### Scenario: removing an upload takes it out of the picks
- **GIVEN** the upload PIN `4321`, `photos/00001-a.jpg`, a `thanksgiving` folder with `dusk.mp4`, and a picks file holding `photos/00001-a.jpg` then `thanksgiving/dusk.mp4`
- **WHEN** the website is asked to remove `00001-a.jpg` with PIN `4321`
- **THEN** the picks file holds just `thanksgiving/dusk.mp4`
