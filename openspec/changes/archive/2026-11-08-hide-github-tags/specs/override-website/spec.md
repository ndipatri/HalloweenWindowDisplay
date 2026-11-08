# Delta for override-website

## MODIFIED Requirements

### Requirement: Offers the tags under Play
The website SHALL list every tag in use that no GitHub filter names (in its any of or except), in name order, and every filter, custom then GitHub, as its choices, and its page SHALL offer each as a button that selects it, several at a time (tags in one row, filters in another), a Play button that shows what is selected for the chosen duration, Black, the durations, and Back to schedule.

#### Scenario: the website lists the tags as choices
- **GIVEN** the starting GitHub filters, `halloween/fuzzy.mp4`, `halloween/grownup/jump.mp4`, `thanksgiving/dusk.mp4`, `christmas/tree.mp4`, and `photos/00001-a.jpg` tagged `favorites`
- **WHEN** the website is asked for its choices
- **THEN** the tags are `christmas`, `favorites` and `upload`, leaving out the tags the GitHub filters name
- **AND** the filters are Halloween kid, Halloween grownup and Thanksgiving

#### Scenario: the website page offers each choice
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a button for black and for Back to schedule, and a choice of until the schedule changes, 15, 30 or 60 minutes, or until switched back

#### Scenario: the page offers each tag under Play, to pick several and play
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** its Play section makes a button for each of the website's tags, labelled as words, and one for each of its filters, in a row of their own, each selecting or unselecting it without showing anything
- **AND** a Play button shows what is selected for the chosen duration, and is off while nothing is selected

#### Scenario: the page labels tags as words
- **GIVEN** the page
- **WHEN** it labels the tags `halloween-grownup`, `favorites` and `upload`
- **THEN** they read `Halloween grownup`, `Favorites` and `Uploads`
