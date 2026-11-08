# Proposal

## Why

Only filters can be played today, so playing one tag needs a filter made for it. The person wants any tag playable on demand, with filters there to combine tags with a schedule, and the Play section a multi-select of tags and filters, so any mix can be started on demand.

## What Changes

- **Play is a multi-select of tags and filters.** Under Play there is a button for every tag in use (`halloween`, `halloween-grownup`, `thanksgiving`, `favorites`, `upload`, …), labelled as words ("Halloween grownup", "Favorites", "Uploads"), and, in a second row, every filter (custom first, then GitHub).
  - Tapping buttons selects them (they light up) without touching the TV.
  - **Play** then shows everything with any of the selected tags, plus everything each selected filter picks (its tags, minus its except tags), for the chosen "For how long".
  - **Black** and **Back to schedule** stay.
  - The tags playing now are outlined.
- **Filters combine tags with a schedule.** They play on their schedule, or when picked under Play. A filter must have at least one entry with days: the website refuses one without (`Party: a filter needs days and times; to play tags any time, pick them under Play.`), and the box skips one in a file.
- **Favorites and All uploads stop being filters.** They had no schedule; the `favorites` and `upload` tags under Play replace them. `playlists/filters.json` keeps Halloween kid, Halloween grownup and Thanksgiving.
- **Status and log name what was picked**, tags with a `#`, then filters: `#favorites + Halloween kid (override until cleared)`, and `#favorites + Halloween kid: playing x.jpg`. A scheduled filter still reads `Thanksgiving (scheduled until 11:00 PM)`.
- **Overrides** name tags and filters: `{ "tags": ["favorites"], "filters": ["Halloween kid"], … }`, or `{ "tags": null }` for black. An override naming a filter that's gone is ended, as today; one from before (the old single-filter or playlist form) is ended and logged.
- **API:**
  - `GET /api/choices` → `{ tags, filters }`;
  - `POST /api/show { tags: [...], filters: [...], until }` or `{ target: 'black' }`, refusing a tag that isn't in use, a filter the box doesn't have, or an empty choice.
- Unchanged: tags themselves, uploads, filters' day and time rules, custom vs GitHub filters, the editor (it now requires days and times).

## Capabilities

### New Capabilities

### Modified Capabilities
- `overrides`: an override plays a set of tags and filters, or black; overrides from before end.
- `override-website`: the Play section and its API pick tags and filters; the outline follows what is playing.
- `filters`: a filter needs days and times; Favorites and All uploads are no longer GitHub filters; scenarios that played filters on demand play tags.
- `tags`: the scenario that played the Favorites filter plays the `favorites` tag.

## Impact

- `scheduler/logic.js`:
  - overrides of tags;
  - a playlist for a set of tags and filters (key `#a + Filter name`);
  - filters must have days.
- `scheduler/website.js`:
  - `/api/choices`, `/api/show`;
  - the Play section (multi-select of tags and filters, Play, outline), with `playingChoices` in place of `playingFilter`;
  - the editor requires an entry.
- `playlists/filters.json`: Favorites and All uploads removed.
- Tests: `scheduler.test.js`, `player.test.js`, `website.test.js`. The rehearsal's `inside.sh` shows tags instead of filters.
- README ("What's playing", "Using it"), the window-display-schedule and window-display-video skills.
- On the box: rerun setup once (code changed); the GitHub filters change arrives with the sync.

## Product decisions

From the person:
- Any tag can be played; a filter is for combining tags with a schedule, and can be picked under Play too.
- The Play section is multi-select: pick tags and filters, then tap Play.

## Assumed product decisions

Mine; change any of them.
- Favorites and All uploads are removed as GitHub filters, as their tags replace them.
- Tag buttons are labelled as words; `upload` reads "Uploads".
- A filter must have days and times.
- A `#` marks tags in the status and log.
- An override from before this change is ended, not converted.
