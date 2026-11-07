# Proposal

## Why

The person wants a choice made on the website to stay on until they switch back, without changing "For how long" every time. Today the page starts on "Until the schedule changes".

## What Changes

- On the page, **For how long** starts on **Until switched back**. The other durations are still there.
- **Trade-off:** with this default, a choice no longer ends by itself, so a forgotten one (e.g. the grownup videos) stays on through the night and into the morning until someone taps **Back to schedule**, unless a shorter time is picked first. The README says so.
- The website's API is unchanged: a `POST /api/show` without `until` still lasts until the schedule changes. Only the page's starting choice changes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `override-website`: the page starts For how long on Until switched back.

## Impact

- `scheduler/website.js`: the page's `<select>` only.
- `scheduler/tests/website.test.js`: one new page scenario.
- README ("See what's on, or play something else for a while") and the window-display-schedule skill.
- On the box: rerun setup (code under `scheduler/` changed).

## Product decisions

From the person: For how long defaults to "until I switch back".

## Assumed product decisions

Mine; change them if you like.
- The page doesn't remember a different choice between visits: each visit starts on Until switched back.
- The options stay in the same order.
