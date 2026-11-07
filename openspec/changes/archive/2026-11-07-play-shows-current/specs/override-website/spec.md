# Spec Delta

## ADDED Requirements

### Requirement: The page shows what is playing under Play
The page SHALL show the status line inside the Play section, above its buttons, and SHALL outline, and mark as current, the Play button for what the status says is on the window: the Kid or Grownup button for that playlist in any season, My picks for `picks`, All uploads for `photos`, and Black for any black. It SHALL outline none while a whole season or a playlist the schedule doesn't name is previewed, or when the box can't be reached, and SHALL follow the status as it changes.

#### Scenario: the page shows the status under Play and outlines what is playing
- **GIVEN** the website running
- **WHEN** the page is opened
- **THEN** the status line is inside the Play section, before its buttons, with no separate status card above it
- **AND** the button for what is playing is outlined and has `aria-current="true"`, and the outline is updated with the status

#### Scenario: the page works out which Play button is playing from the status
- **GIVEN** the page, and the playlists `kid` and `grownup`
- **WHEN** the status is `thanksgiving/kid (scheduled until 7:30 PM)`, `halloween/grownup (override until cleared)`, `kid (scheduled until 7:00 AM)`, `picks (override until cleared)`, `photos (override until 8:15 PM, then back to the schedule)`, `black (outside schedule until 5:00 PM)`, `black (no season today, Nov 2)`, `black (waiting for the clock to be set)`, `kid (override until cleared)`, `black (override until cleared; asked for kid but no season today)`, `halloween/scary (override until cleared)`, `thanksgiving (override until cleared)`, and no status
- **THEN** the button playing is Kid, Grownup, Kid, My picks, All uploads, Black, Black, Black, Kid, Black, none, none, and none
