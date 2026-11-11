## MODIFIED Requirements

### Requirement: The page adds and removes photos
The page SHALL offer, at the top of its Photos and videos section, the phone's picker for photos and videos, several at a time, a PIN field it remembers, and a progress line per file. Below them, in the same section, it SHALL list each upload once, with a preview, its tags and a Remove button. It SHALL check the whole batch before sending any file, stop at the first refusal, and on a wrong PIN or a lock forget the remembered PIN and ask for it again.

#### Scenario: the website page offers adding and removing photos
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** its Photos and videos section has an Add photos or videos picker that accepts photos and videos, several at a time, and a PIN field
- **AND** the same section lists the uploads from the website's items, each once, with a preview and a Remove button, and there is no separate list of uploads
- **AND** it shows `Adding photos is off until a PIN is set on the box.` when the website says no PIN is set

#### Scenario: the page sends a batch only after the box clears it
- **GIVEN** the page with the PIN `4321` remembered, and a box that clears the batch
- **WHEN** the person picks `a.jpg`, `b.mov` and `c.png`
- **THEN** the page asks the box to check all three first, then sends them one after another in that order, showing each file's answer

#### Scenario: the page stops a batch at a wrong PIN and asks for it again
- **GIVEN** the page with the PIN `1111` remembered, and a box that answers the check with `Wrong PIN.`
- **WHEN** the person picks five photos
- **THEN** the page sends no file, shows `Wrong PIN.`, forgets the remembered PIN and empties the PIN field
