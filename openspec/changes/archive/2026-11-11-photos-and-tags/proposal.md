## Why

The page showed your uploads twice: once under Tags (to star and tag them) and again under Photos and videos added (to see and remove them), with Add photos or videos in a third section in between. One list is easier to use, especially on a phone.

## What Changes

- **One Photos and videos section** takes the place of Tags, Add photos or videos, and Photos and videos added. At the top: the PIN and the Add photos or videos picker. Below: each upload once, with a small preview, its name, a favorites star, Remove, its tags and a field to add one.
- Nothing changes on the box: the same website calls, PIN rules and tags.

## Capabilities

### Modified Capabilities

- `photo-uploads`: "The page adds and removes photos" now lists each upload once, in the Photos and videos section, with Remove next to its tags.
- `override-website`: "The page tags items" now happens in that same section.

## Impact

- **Code:** `scheduler/website.js` (page only).
- **Tests and docs:** `website.test.js`, the README, the schedule skill.
