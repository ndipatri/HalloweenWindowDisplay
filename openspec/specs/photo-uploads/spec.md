# photo-uploads Specification

## Purpose
Lets the person add their own photos and videos to the box from a phone through the website, and remove them again, with no PIN (the website is only on the home network), kept within the SD card's room.

## Requirements

### Requirement: Uploads are numbered in the order they arrive
Each upload's name SHALL be a five-digit number one above the highest number in `photos/` (`00001` when there is none), a dash, and its own name cleaned: lower case, ASCII letters, digits, `.`, `-` and `_` kept, other runs made one dash, dashes trimmed at the ends and beside the dot, at most 60 characters, and `upload` if nothing is left.

#### Scenario: uploads are numbered in the order they arrived
- **GIVEN** no uploads
- **WHEN** the website is sent `IMG_1.JPG`, `IMG_1.JPG` again and `Beach Day!!.mov`, in that order, within one second
- **THEN** `photos/` holds `00001-img_1.jpg`, `00002-img_1.jpg` and `00003-beach-day.mov`
- **AND** the website lists them in that order

#### Scenario: numbering carries on after the highest upload
- **GIVEN** `photos/` holding `00002-a.jpg` and `00007-b.jpg`
- **WHEN** the website is sent `c.jpg`
- **THEN** it is saved as `photos/00008-c.jpg`

#### Scenario: a name with nothing usable left is called upload
- **GIVEN** no uploads
- **WHEN** the website is sent `写真.jpg`
- **THEN** it is saved as `photos/00001-upload.jpg`

### Requirement: Only photos and videos the box can show
The website SHALL accept only `.jpg`, `.jpeg` and `.png` photos and `.mp4`, `.mov` and `.m4v` videos, in any letter case, and SHALL refuse anything else without saving it.

#### Scenario: the website refuses a file that isn't a photo or video it can show
- **GIVEN** the website running
- **WHEN** the website is sent `notes.txt`, then `IMG_1.HEIC`, then `noextension`
- **THEN** each is refused with `Only JPEG or PNG photos and MP4, MOV or M4V videos can be added.`
- **AND** nothing is added to `photos/`

### Requirement: Uploads stay within the card's room
The website SHALL refuse, before reading it, a file over 1 GB, and a file that would leave less than 2 GB free on the SD card.

#### Scenario: the website refuses a file over 1 GB
- **GIVEN** 20 GB free
- **WHEN** the website is sent `long.mov` of 1 GB and one byte
- **THEN** it is refused with `Too big: one file can be at most 1 GB.`
- **AND** nothing is added to `photos/`, and the file's bytes are never read

#### Scenario: the website refuses an upload that would leave under 2 GB free
- **GIVEN** 2.5 GB free
- **WHEN** the website is sent `clip.mov` of 600 MB
- **THEN** it is refused with `Not enough room on the box for clip.mov: 2 GB must stay free.`
- **AND** nothing is added to `photos/`, and the file's bytes are never read

### Requirement: No half-uploaded files
An upload that stops before all its bytes arrive SHALL leave nothing in `photos/`, not even a hidden part, and SHALL be logged.

#### Scenario: an upload that stops partway leaves nothing behind
- **GIVEN** the website running
- **WHEN** the website is sent `clip.mov`, said to be 10 MB, and the phone stops after 5 MB
- **THEN** `photos/` holds no file at all, hidden or not
- **AND** the log says `Upload of clip.mov stopped partway; nothing kept.`

### Requirement: Lists the uploads
The website SHALL list the uploads in the order they play, each with its name, whether it is a photo or a video, and its size in bytes, leaving out hidden files and files it would not play.

#### Scenario: the website lists the uploads in the order they play
- **GIVEN** `photos/` holding `00002-b.mp4`, `00001-a.jpg`, `.upload-123` and `notes.txt`
- **WHEN** the website is asked for the uploads
- **THEN** it lists `00001-a.jpg` as a photo, then `00002-b.mp4` as a video, each with its size

#### Scenario: the website lists no uploads when there are none
- **GIVEN** no `photos/` folder
- **WHEN** the website is asked for the uploads
- **THEN** it lists none

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

### Requirement: Checks a whole batch before it is sent
Asked to check a batch of file names and sizes, the website SHALL make the same type, size and room checks it makes on upload, with the room counted for the whole batch, and SHALL answer with the first refusal or that the batch is ready, saving nothing.

#### Scenario: the website clears a batch before it is sent
- **GIVEN** 20 GB free
- **WHEN** the website is asked to check `a.jpg` (3 MB), `b.mov` (200 MB) and `c.png` (1 MB)
- **THEN** it answers `Ready to add 3 files.`
- **AND** nothing is added to `photos/`

#### Scenario: the website refuses a batch that wouldn't fit before it is sent
- **GIVEN** 3 GB free
- **WHEN** the website is asked to check `a.mov` (600 MB) and `b.mov` (600 MB)
- **THEN** it answers `Not enough room on the box for these 2 files: 2 GB must stay free.`

### Requirement: Removes an upload with no PIN
Asked by anyone on the home network, with no PIN, the website SHALL take the upload off the screen and out of what is queued, delete it, say so, and log it. It SHALL refuse a name that isn't an upload, deleting nothing.

#### Scenario: the website removes an upload with no PIN
- **GIVEN** `photos/00001-a.jpg`
- **WHEN** the website is asked to remove `00001-a.jpg`
- **THEN** `photos/00001-a.jpg` is gone
- **AND** the website answers `Removed 00001-a.jpg.`
- **AND** the log says `Removed photos/00001-a.jpg (from the website)`

#### Scenario: the website refuses to remove something that isn't an upload
- **GIVEN** `photos/.upload-123`, and the status file
- **WHEN** the website is asked to remove `../status`, then `.upload-123`, then `missing.jpg`
- **THEN** each is refused with `No upload named` and the name
- **AND** the status file and `photos/.upload-123` are still there

### Requirement: The page adds and removes photos with no PIN
The page SHALL offer, at the top of its Photos and videos section, the phone's picker for photos and videos, several at a time, and a progress line per file, with no PIN. Below them, in the same section, it SHALL list each upload once, with a preview, its tags and a Remove button. It SHALL check the whole batch before sending any file and stop at the first refusal.

#### Scenario: the website page offers adding and removing photos
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** its Photos and videos section has an Add photos or videos picker that accepts photos and videos, several at a time, and no PIN field
- **AND** the same section lists the uploads from the website's items, each once, with a preview and a Remove button, and there is no separate list of uploads

#### Scenario: the page sends a batch only after the box clears it
- **GIVEN** the page, and a box that clears the batch
- **WHEN** the person picks `a.jpg`, `b.mov` and `c.png`
- **THEN** the page asks the box to check all three first, then sends them one after another in that order, showing each file's answer

### Requirement: Adds an upload with no PIN
The website SHALL save an uploaded file in `~/video-scheduler/photos/` for anyone on the home network, with no PIN, SHALL say what it added, and SHALL log the upload.

#### Scenario: the website adds a photo with no PIN
- **GIVEN** no uploads
- **WHEN** the website is sent `IMG_1234.JPG`, 2 MB, with no PIN
- **THEN** `photos/00001-img_1234.jpg` holds the file's bytes
- **AND** the website answers `Added IMG_1234.JPG.`
- **AND** the log says `Uploaded photos/00001-img_1234.jpg (2.0 MB)`

### Requirement: Setup asks for no upload PIN
Setup SHALL NOT ask for, or save, an upload PIN, and SHALL remove one an older setup saved, saying so. It SHALL make the `photos/` folder.

#### Scenario: setup asks for no upload PIN and removes an old one
- **GIVEN** `~/video-scheduler/upload-pin` holding `4321` from an older setup
- **WHEN** setup runs, terminal or not
- **THEN** it asks for no PIN and finishes
- **AND** `~/video-scheduler/upload-pin` is gone, and it printed `The upload PIN is no longer used, so it was removed.`

#### Scenario: setup makes the photos folder
- **GIVEN** no `~/video-scheduler/photos/`
- **WHEN** setup runs
- **THEN** `~/video-scheduler/photos/` exists, and an upload already in it is kept when setup runs again
