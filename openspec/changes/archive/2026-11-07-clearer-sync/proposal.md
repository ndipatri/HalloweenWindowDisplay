# Proposal

## Why

The person couldn't tell what the website's "Videos / Sync now" section does. It runs the same sync the box runs every hour: it gets the latest from GitHub, copies new or changed videos onto the box, and sets aside ones taken out of the repo. Nothing on the page says so, nor that it leaves the box's own software and schedule as they are.

## What Changes

- The section is headed **New videos from GitHub**, not "Videos".
- One line explains it: `The box checks GitHub for new videos every hour by itself. New ones play within a minute or two; ones taken out are set aside on the box, not deleted. Your uploads and picks aren't touched, and the box's own settings and schedule don't change.`
- The button reads **Check for new videos now**, not "Sync now".
- The replies:
  - starting: `Checking GitHub for new videos. New ones play within a minute or two; watch Recent activity below.`
  - while one is still running: `Already checking for new videos.`
- The reply shows just under the button, not in the message line near the top of the page.
- What the sync does is unchanged, and so is the log's wording.

## Capabilities

### New Capabilities

### Modified Capabilities
- `override-website`: the sync replies, and the page's wording for the section.

## Impact

- `scheduler/website.js`: the two replies and the page section.
- `scheduler/tests/website.test.js`: the two reply tests and the page test, renamed to match.
- README and the window-display-schedule skill: the button's new name. The rehearsal's check names in `inside.sh` too.
- On the box: rerun setup (code under `scheduler/` changed).

## Product decisions

From the person: make the section clearer, with wording only; no "last checked" line.

## Assumed product decisions

The wording above is mine; change any of it.
