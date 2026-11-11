# photo-uploads Specification

## Purpose
Lets the person add their own photos and videos to the box from a phone through the website, and remove them again, guarded by an upload PIN and kept within the SD card's room.

## Requirements

### Requirement: Uploads need the PIN
The website SHALL save an uploaded file in `~/video-scheduler/photos/` only when the request carries the box's upload PIN, SHALL say what it added, and SHALL log the upload. It SHALL refuse every upload, saving nothing, when the PIN is wrong or missing or no valid PIN is set.

#### Scenario: the website adds a photo with the right PIN
- **GIVEN** the upload PIN `4321` and no uploads
- **WHEN** the website is sent `IMG_1234.JPG`, 2 MB, with PIN `4321`
- **THEN** `photos/00001-img_1234.jpg` holds the file's bytes
- **AND** the website answers `Added IMG_1234.JPG.`
- **AND** the log says `Uploaded photos/00001-img_1234.jpg (2.0 MB)`

#### Scenario: the website refuses an upload with the wrong PIN
- **GIVEN** the upload PIN `4321` and no uploads
- **WHEN** the website is sent `IMG_1234.JPG` with PIN `1111`
- **THEN** the upload is refused with `Wrong PIN.`
- **AND** nothing is added to `photos/`

#### Scenario: the website refuses an upload with no PIN
- **GIVEN** the upload PIN `4321` and no uploads
- **WHEN** the website is sent `IMG_1234.JPG` with no PIN
- **THEN** the upload is refused with `Wrong PIN.`
- **AND** nothing is added to `photos/`

#### Scenario: the website refuses uploads while no PIN is set
- **GIVEN** no upload PIN file
- **WHEN** the website is sent `IMG_1234.JPG` with PIN `4321`
- **THEN** the upload is refused with `Adding photos is off: no upload PIN is set on the box.`
- **AND** nothing is added to `photos/`

#### Scenario: a PIN file that isn't 4 to 8 digits leaves uploads off
- **GIVEN** an upload PIN file holding `12`
- **WHEN** the website is sent `IMG_1234.JPG` with PIN `12`
- **THEN** the upload is refused with `Adding photos is off: no upload PIN is set on the box.`
- **AND** nothing is added to `photos/`

### Requirement: Too many wrong PINs lock uploads
After five wrong or missing PINs in a row, counting uploads, checks and removals together, the website SHALL refuse all three, even with the right PIN, for five minutes, and SHALL log the lock once. A right PIN SHALL start the count again.

#### Scenario: five wrong PINs in a row lock uploads for five minutes
- **GIVEN** the upload PIN `4321`, and it is 6:00 PM on Nov 4, 2026
- **WHEN** five uploads are sent with PIN `1111`, then one with PIN `4321` at 6:01 PM, and one with PIN `4321` at 6:05 PM
- **THEN** the upload at 6:01 PM is refused with `Too many wrong PINs. Try again after 6:05 PM.`
- **AND** the log says `Five wrong upload PINs in a row: uploads locked until 6:05 PM` once
- **AND** the upload at 6:05 PM is added

#### Scenario: a right PIN starts the count of wrong PINs again
- **GIVEN** the upload PIN `4321`, and it is 6:00 PM on Nov 4, 2026
- **WHEN** four uploads are sent with PIN `1111`, then one with `4321`, then four more with `1111`, then one with `4321`
- **THEN** both uploads with `4321` are added

### Requirement: Uploads are numbered in the order they arrive
Each upload's name SHALL be a five-digit number one above the highest number in `photos/` (`00001` when there is none), a dash, and its own name cleaned: lower case, ASCII letters, digits, `.`, `-` and `_` kept, other runs made one dash, dashes trimmed at the ends and beside the dot, at most 60 characters, and `upload` if nothing is left.

#### Scenario: uploads are numbered in the order they arrived
- **GIVEN** the upload PIN `4321` and no uploads
- **WHEN** the website is sent `IMG_1.JPG`, `IMG_1.JPG` again and `Beach Day!!.mov`, in that order, within one second
- **THEN** `photos/` holds `00001-img_1.jpg`, `00002-img_1.jpg` and `00003-beach-day.mov`
- **AND** the website lists them in that order

#### Scenario: numbering carries on after the highest upload
- **GIVEN** the upload PIN `4321`, and `photos/` holding `00002-a.jpg` and `00007-b.jpg`
- **WHEN** the website is sent `c.jpg`
- **THEN** it is saved as `photos/00008-c.jpg`

#### Scenario: a name with nothing usable left is called upload
- **GIVEN** the upload PIN `4321` and no uploads
- **WHEN** the website is sent `写真.jpg`
- **THEN** it is saved as `photos/00001-upload.jpg`

### Requirement: Only photos and videos the box can show
The website SHALL accept only `.jpg`, `.jpeg` and `.png` photos and `.mp4`, `.mov` and `.m4v` videos, in any letter case, and SHALL refuse anything else without saving it.

#### Scenario: the website refuses a file that isn't a photo or video it can show
- **GIVEN** the upload PIN `4321`
- **WHEN** the website is sent `notes.txt`, then `IMG_1.HEIC`, then `noextension`, each with PIN `4321`
- **THEN** each is refused with `Only JPEG or PNG photos and MP4, MOV or M4V videos can be added.`
- **AND** nothing is added to `photos/`

### Requirement: Uploads stay within the card's room
The website SHALL refuse, before reading it, a file over 1 GB, and a file that would leave less than 2 GB free on the SD card.

#### Scenario: the website refuses a file over 1 GB
- **GIVEN** the upload PIN `4321` and 20 GB free
- **WHEN** the website is sent `long.mov` of 1 GB and one byte, with PIN `4321`
- **THEN** it is refused with `Too big: one file can be at most 1 GB.`
- **AND** nothing is added to `photos/`, and the file's bytes are never read

#### Scenario: the website refuses an upload that would leave under 2 GB free
- **GIVEN** the upload PIN `4321` and 2.5 GB free
- **WHEN** the website is sent `clip.mov` of 600 MB, with PIN `4321`
- **THEN** it is refused with `Not enough room on the box for clip.mov: 2 GB must stay free.`
- **AND** nothing is added to `photos/`, and the file's bytes are never read

### Requirement: Checks a batch before it is sent
Asked to check a batch of file names and sizes with a PIN, the website SHALL make the same PIN, lock, type, size and room checks it makes on upload, with the room counted for the whole batch, and SHALL answer with the first refusal or that the batch is ready, saving nothing.

#### Scenario: the website clears a batch before it is sent
- **GIVEN** the upload PIN `4321` and 20 GB free
- **WHEN** the website is asked, with PIN `4321`, to check `a.jpg` (3 MB), `b.mov` (200 MB) and `c.png` (1 MB)
- **THEN** it answers `Ready to add 3 files.`
- **AND** nothing is added to `photos/`

#### Scenario: the website refuses a batch with the wrong PIN before it is sent
- **GIVEN** the upload PIN `4321`
- **WHEN** the website is asked, with PIN `1111`, to check `a.jpg` and `b.jpg`
- **THEN** it answers `Wrong PIN.`
- **AND** that counts as one wrong PIN

#### Scenario: the website refuses a batch that wouldn't fit before it is sent
- **GIVEN** the upload PIN `4321` and 3 GB free
- **WHEN** the website is asked, with PIN `4321`, to check `a.mov` (600 MB) and `b.mov` (600 MB)
- **THEN** it answers `Not enough room on the box for these 2 files: 2 GB must stay free.`

### Requirement: No half-uploaded files
An upload that stops before all its bytes arrive SHALL leave nothing in `photos/`, not even a hidden part, and SHALL be logged.

#### Scenario: an upload that stops partway leaves nothing behind
- **GIVEN** the upload PIN `4321`
- **WHEN** the website is sent `clip.mov`, said to be 10 MB, and the phone stops after 5 MB
- **THEN** `photos/` holds no file at all, hidden or not
- **AND** the log says `Upload of clip.mov stopped partway; nothing kept.`

### Requirement: Lists the uploads
The website SHALL list the uploads in the order they play, each with its name, whether it is a photo or a video, and its size in bytes, leaving out hidden files and files it would not play. It SHALL also say whether an upload PIN is set.

#### Scenario: the website lists the uploads in the order they play
- **GIVEN** the upload PIN `4321`, and `photos/` holding `00002-b.mp4`, `00001-a.jpg`, `.upload-123` and `notes.txt`
- **WHEN** the website is asked for the uploads
- **THEN** it lists `00001-a.jpg` as a photo, then `00002-b.mp4` as a video, each with its size
- **AND** it says a PIN is set

#### Scenario: the website lists no uploads when there are none
- **GIVEN** no upload PIN and no `photos/` folder
- **WHEN** the website is asked for the uploads
- **THEN** it lists none
- **AND** it says no PIN is set

### Requirement: Sends an upload for its preview
The website SHALL send an upload's bytes with its type, to anyone on the home network, whole or the single byte range asked for, and SHALL let the phone keep it, since an upload's name never changes. It SHALL send nothing outside `photos/` or hidden.

#### Scenario: the website sends an upload
- **GIVEN** `photos/00001-a.jpg`
- **WHEN** the website is asked for `/photos/00001-a.jpg`
- **THEN** it answers with the file's bytes as `image/jpeg`
- **AND** it lets the phone keep the file for a year

#### Scenario: the website sends part of a video when asked for a range
- **GIVEN** `photos/00002-b.mp4` of 1,000 bytes
- **WHEN** the website is asked for `/photos/00002-b.mp4` with the range `bytes=0-1`
- **THEN** it answers 206 with the first two bytes as `video/mp4` and the range `bytes 0-1/1000`

#### Scenario: the website sends the rest of a video from a byte onwards
- **GIVEN** `photos/00002-b.mp4` of 1,000 bytes
- **WHEN** the website is asked for `/photos/00002-b.mp4` with the range `bytes=900-`
- **THEN** it answers 206 with the last 100 bytes and the range `bytes 900-999/1000`

#### Scenario: the website refuses a range past the end of an upload
- **GIVEN** `photos/00002-b.mp4` of 1,000 bytes
- **WHEN** the website is asked for `/photos/00002-b.mp4` with the range `bytes=1000-`
- **THEN** it answers 416 with the range `bytes */1000`

#### Scenario: the website sends nothing outside the uploads
- **GIVEN** `photos/.upload-123` and `override.json`
- **WHEN** the website is asked for `/photos/../override.json`, `/photos/.upload-123` and `/photos/missing.jpg`
- **THEN** each answer is 404 `Not found.`

### Requirement: Removes an upload
With the right PIN, the website SHALL take the upload off the screen and out of what is queued, delete it, say so, and log it. It SHALL refuse with a wrong PIN, and refuse a name that isn't an upload, deleting nothing.

#### Scenario: the website removes an upload with the right PIN
- **GIVEN** the upload PIN `4321` and `photos/00001-a.jpg`
- **WHEN** the website is asked to remove `00001-a.jpg` with PIN `4321`
- **THEN** `photos/00001-a.jpg` is gone
- **AND** the website answers `Removed 00001-a.jpg.`
- **AND** the log says `Removed photos/00001-a.jpg (from the website)`

#### Scenario: the website refuses to remove an upload with the wrong PIN
- **GIVEN** the upload PIN `4321` and `photos/00001-a.jpg`
- **WHEN** the website is asked to remove `00001-a.jpg` with PIN `1111`
- **THEN** it is refused with `Wrong PIN.`
- **AND** `photos/00001-a.jpg` is still there

#### Scenario: the website refuses to remove something that isn't an upload
- **GIVEN** the upload PIN `4321`, `photos/.upload-123`, and the status file
- **WHEN** the website is asked, with PIN `4321`, to remove `../status`, then `.upload-123`, then `missing.jpg`
- **THEN** each is refused with `No upload named` and the name
- **AND** the status file and `photos/.upload-123` are still there

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

### Requirement: Setup sets the upload PIN
Setup SHALL save the upload PIN given in `TVBOX_UPLOAD_PIN`, readable only by the person's user, keep a saved PIN when none is given, refuse one that isn't 4 to 8 digits before changing anything, and say how to turn adding photos on when there is no PIN. It SHALL make the `photos/` folder.

#### Scenario: setup saves the upload PIN it is given
- **GIVEN** no saved upload PIN
- **WHEN** setup runs with `TVBOX_UPLOAD_PIN=4321`
- **THEN** `~/video-scheduler/upload-pin` holds `4321` and only its owner can read it

#### Scenario: setup keeps the saved upload PIN
- **GIVEN** `~/video-scheduler/upload-pin` holding `4321`
- **WHEN** setup runs with no `TVBOX_UPLOAD_PIN` and no terminal
- **THEN** `~/video-scheduler/upload-pin` still holds `4321`

#### Scenario: setup refuses an upload PIN that isn't 4 to 8 digits
- **GIVEN** no saved upload PIN
- **WHEN** setup runs with `TVBOX_UPLOAD_PIN=12a4`
- **THEN** it stops with an error saying `The upload PIN must be 4 to 8 digits.`
- **AND** it has installed nothing and saved no PIN

#### Scenario: setup without a PIN or a terminal leaves adding photos off
- **GIVEN** no saved upload PIN
- **WHEN** setup runs with no `TVBOX_UPLOAD_PIN` and no terminal
- **THEN** it finishes, and prints `No upload PIN set, so adding photos is off. To turn it on: sudo TVBOX_UPLOAD_PIN=<4 to 8 digits> bash scheduler/setup.sh`
- **AND** no `~/video-scheduler/upload-pin` exists

#### Scenario: setup makes the photos folder
- **GIVEN** no `~/video-scheduler/photos/`
- **WHEN** setup runs
- **THEN** `~/video-scheduler/photos/` exists, and an upload already in it is kept when setup runs again
