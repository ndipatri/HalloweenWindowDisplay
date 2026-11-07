# Proposal

## Why

The person wants the seasons among the Play buttons, rather than in a separate "Preview a season" section with a drop-down and its own button.

## What Changes

- The Play card gets a row of season buttons under the others, after a small "Seasons" label: one per season folder and season/playlist folder on the box, labelled as the drop-down was (`Halloween`, `Halloween / Grownup`, `Thanksgiving`). Each plays that season for the chosen "For how long", as Preview did.
- The **Preview a season** section (drop-down and Preview button) is removed.
- The outline marks every button that plays what is on the window:
  - the season button for a season shown on its own (`thanksgiving`);
  - for `halloween/grownup`, both **Grownup** and **Halloween / Grownup**, as either would play it.
- **Fixes the outline for Kid and Grownup** (from the change that added it): `halloween/grownup` outlined Grownup on any day, but on a Thanksgiving day Grownup plays Thanksgiving's grownup videos. Now Kid and Grownup are outlined only when today's season's playlist is on. To know today's season, `GET /api/status` also answers `season` (today's, or null).
- No change to what the website can show: `GET /api/choices` still lists the same `previews`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `override-website`: the page offers the seasons as Play buttons instead of a Preview section, and outlines them; the status answer names today's season.

## Impact

- `scheduler/website.js`: the page, and `GET /api/status`'s `season`.
- `scheduler/tests/website.test.js`: the page scenarios.
- README ("preview a season"), the window-display-schedule skill, and the window-display-video skill (how to see a new video).
- On the box: rerun setup (code under `scheduler/` changed).

## Product decisions

From the person: seasons as Play buttons, and no Preview a season section.

## Assumed product decisions

Mine; change any of them.
- Season buttons come after Kid, Grownup, My picks, All uploads and Black, under a small "Seasons" label in the same card.
- Season/playlist folders get their own buttons too (`Halloween / Grownup`), as they were in the drop-down.
- When two buttons would play the same thing (on a Halloween day, Grownup and Halloween / Grownup), both are outlined.
