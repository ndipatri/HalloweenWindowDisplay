# Spec Delta

## ADDED Requirements

### Requirement: The page starts on until switched back
The page's For how long choice SHALL start on Until switched back each time the page is opened, with the other durations still offered. A request to show something that gives no duration SHALL still last until the schedule changes.

#### Scenario: the page starts For how long on until switched back
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** For how long has Until switched back chosen, and only that option chosen
