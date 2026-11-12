## ADDED Requirements

### Requirement: The page shows each upload's measured shape
The page SHALL mark the thumbnail of each upload that has neither a `portrait` nor a `landscape` tag with the shape the box measured: `portrait`, `landscape` or `square`, or `?` when it can't be measured. An upload with a shape tag SHALL show no mark.

#### Scenario: the website page marks each untagged upload's thumbnail with its measured shape
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** it marks each upload's thumbnail with the shape from the website's items, or `?` when there is none, unless the upload is tagged `portrait` or `landscape`
