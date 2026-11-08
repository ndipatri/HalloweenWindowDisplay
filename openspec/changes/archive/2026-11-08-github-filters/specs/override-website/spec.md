# Spec Delta

## MODIFIED Requirements

### Requirement: The page edits filters
The page SHALL offer a Filters section listing the box's custom filters in order, with ways to move each up or down, edit, delete and add one, and, apart from them, the GitHub filters in order with their tags and schedules but no way to change them, saying they come from GitHub. Editing SHALL cover the name, "any of" and "except" tags chosen from the tags in use, and schedule entries (first and last day, weekdays, extra days, and times). Saving SHALL send the custom filters with the upload PIN, and show the website's answer there.

#### Scenario: the website page offers editing filters with the PIN
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it has a Filters section filled from the website's filters: the custom ones with up, down, edit and delete, and new filter, an editor for the name, tags and schedule entries, and a save that sends the custom filters with the PIN and shows the answer in the section
- **AND** a read-only list of the GitHub filters, saying they come from GitHub and are changed there

#### Scenario: the page moves a filter up and down
- **GIVEN** the page with the filters Halloween kid, Christmas and Favorites
- **WHEN** the person moves Favorites up, then Halloween kid down
- **THEN** the list is first Halloween kid, Favorites, Christmas, then Favorites, Halloween kid, Christmas
