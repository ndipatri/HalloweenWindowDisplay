## Why

The box plays only what fits the way the TV faces, using each upload's measured shape unless it is tagged `portrait` or `landscape`. The website didn't say what shape the box measured, so there was no way to tell, short of turning the TV, which uploads would play which way, or which needed a shape tag.

## What Changes

- **The items list says each upload's measured shape** (`portrait`, `landscape`, `square`, or none when it can't be measured). The website measures uploads the way the player does.
- **The page marks each thumbnail with that shape** when the upload has no `portrait` or `landscape` tag: `portrait`, `landscape` or `square`, or `?` when the box can't tell (it then doesn't play until tagged). An upload with a shape tag shows the tag, as now, and no mark.

## Capabilities

### Modified Capabilities

- `tags`: a new requirement, "Says each upload's measured shape".
- `override-website`: a new requirement, "The page shows each upload's measured shape".

## Impact

- **Code:** `scheduler/website.js` (items list and page), `scheduler/player.js` (gives the website the measuring).
- **Tests and docs:** `website.test.js`, the README.
