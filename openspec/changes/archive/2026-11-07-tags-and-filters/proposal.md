# Proposal

## Why

What the window plays is chosen in three separate ways, each with its own rules:
- **seasons** (which days a folder plays) multiplied by the **daily schedule** (which times a kid or grownup subfolder plays), both in `config.js` in the repo;
- **My picks**, a hand-ticked list on the box;
- **All uploads**, a fixed choice.

Changing what plays when means editing `config.js` and rerunning setup. Mixing a few photos with some Halloween videos is only possible through My picks.

The person wants one idea instead: every item has **tags**, a **filter** shows every item with the right tags, and filters can be **scheduled**. Choosing a season, a playlist, your favorites or your uploads all become "choose a filter".

## What Changes

- **Tags.**
  - Every video in the repo gets **one tag from its folder**, the folder path joined with dashes: `playlists/halloween/fuzzy.mp4` → `halloween`, `playlists/halloween/kid/x.mp4` → `halloween-kid`. Folder tags come from GitHub, so they're the same on every box.
  - Every upload is tagged **`upload`** automatically.
  - Each box can add **its own tags to any item**, repo videos and uploads alike (e.g. `favorites`, `family`), from the website, with no PIN. They're kept on that box only.
  - Folder tags and `upload` can't be removed on the website.
- **Filters.**
  - A filter has a name, a list of tags (**any of**) and an optional list of tags to leave out (**except**). It shows every item with at least one of its tags and none of its except tags.
  - Items play in name order, numbers as numbers (so uploads play in upload order), round and round, as playlists do today.
  - Filters live **on the box**, in an order the person sets, and are created, edited, moved and deleted on the website **with the upload PIN**.
- **Schedules.**
  - Each filter has its own list of schedule entries: **days** (a date range that can wrap the new year, optional weekdays, extra days, and days like `11-4thu` for Thanksgiving, the same rules seasons use today) and one or more **times** (start and stop, crossing midnight if needed).
  - Where two filters' entries overlap, **the filter higher in the list wins**. Outside every entry the window is black.
  - A filter with no entries plays only when chosen.
- **Choosing.**
  - The Play buttons become **one button per filter**, in the box's order, plus Black. For how long, Back to schedule and the outline of what is playing stay as they are, now naming filters.
  - The status line names the filter, e.g. `Halloween kid (scheduled until 7:30 PM)`.
- **Starting filters.** A box with no filters (a new card, or the first setup after this change) gets a starting set copied from the repo. It matches today's window, except that Thanksgiving plays in the evening only and there is no Christmas filter yet (no Christmas videos exist):

  | Filter | Any of | Days | Times |
  |---|---|---|---|
  | Halloween kid | halloween, halloween-kid | Oct 1–31 | 05:00–07:00, 17:00–19:30 |
  | Halloween grownup | halloween, halloween-grownup | Oct 1–31 | 19:30–23:00 |
  | Thanksgiving | thanksgiving | Fri and Sat from Nov 1 to Thanksgiving, plus the day before and the day | 17:00–23:00 |
  | Favorites | favorites | – | – |
  | All uploads | upload | – | – |

  Setup never overwrites a box's own filters.
- **Moving over.**
  - `config.js` loses `seasons` and `schedule`.
  - The old **My picks** become **`favorites`** tags (their tick order isn't kept), and My picks, its list and its page section go.
  - An old override naming a playlist (e.g. `halloween/grownup`) is removed and logged.
- **BREAKING** for anything that used the old API: `POST /api/show` takes a filter name or `black`, `GET /api/choices` lists filters, and `/api/picks` is gone. Only the box's own page uses these.
- **Unchanged:** sync, uploads and their PIN, how photos and videos are shown, the emulator, and the page's sections for adding photos, new videos and recent activity.

## Capabilities

### New Capabilities
- `tags`: folder tags, the `upload` tag, a box's own tags on any item, listing items with their tags, and old My picks becoming `favorites`.
- `filters`: what a filter shows and in what order; keeping, editing and checking filters on the box; the starting set; and what happens on screen when tags or filters change.
- `filter-schedule`: when scheduled filters play: day rules, times, overlaps, black outside every entry, and the status line.

### Modified Capabilities
- `overrides`: an override names a filter (or black) instead of a playlist; an override for a filter that's gone ends.
- `override-website`: the status, the Play buttons, the choices and the refusals are about filters; the page gains Tags and Filters sections and loses Seasons and My picks.
- `box-player`: plays filters rather than season playlists; its scenarios and status lines are reworded.
- `photo-uploads`: uploads no longer join My picks; a removed upload loses its box tags.
- `video-sync`: unchanged in behaviour; its spec is not touched.
- Retired (all requirements removed): `seasons`, `daily-schedule`, `playlists`, `my-picks` and `photos-playback`. What they did is now in `tags`, `filters` and `filter-schedule`.

## Impact

- `scheduler/logic.js`:
  - tags, filter matching, filter schedules (reusing the day rules), and what to show now;
  - the season and playlist code goes;
  - `keepPlaying` takes a filter's items.
- `scheduler/player.js`: reads filters (and rereads them when they change), and generalises `repick` to any filter.
- `scheduler/website.js`:
  - the tags, filters, items and status API; uploads tagged `upload`;
  - the page's Play buttons, and new Tags and Filters sections;
  - My picks and Seasons removed.
- `scheduler/config.js`: no `seasons` or `schedule`.
- New `scheduler/filters.default.json`, the starting set; `scheduler/setup.sh` copies it to a box with no `filters.json`.
- Tests: `scheduler.test.js`, `player.test.js` and `website.test.js` are largely rewritten around filters, plus `setup.test.js`. Retired scenarios' tests are removed or renamed, and the rehearsal's `inside.sh` checks move from playlists to filters.
- README (what plays when is now set on the website; tags; filters) and the window-display-schedule skill (largely rewritten: adding a season is now a folder plus a filter). The window-display-video skill (how to see a new video).
- On the box: rerun setup once (`cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`), which adds the starting filters. Each box keeps its own filters and tags from then on, and they aren't backed up.
- Shipped as **one PR**, built in stages, so a box never runs half of it.

## Product decisions

From the person:
- Tags come from folders in GitHub, one per folder: `halloween/kid` gives `halloween-kid`.
- Each box can add its own tags, to any item.
- A filter is "any of these tags, except these".
- Filters and their schedules are defined on the box.
- Each filter has its own days-and-times entries.
- "My picks" is gone: it's the tag `favorites` and the filter Favorites.
- From the design review: Thanksgiving's starting filter is evening-only with the one tag `thanksgiving` (no kid or grownup folders), and the starting set has no Christmas filter.
- The six smaller points proposed together were accepted as recommended:
  - play order;
  - one Play button per filter;
  - the status names the filter;
  - the PIN for editing filters;
  - moving over;
  - what stays.

## Assumed product decisions

Mine; change any of them.
- **Tag names:** lowercase letters, digits and dashes, up to 30 characters. Folder names are lowercased, with anything else turned into a dash (`Easter Eggs` → `easter-eggs`).
- **A box tag can repeat a folder tag:** e.g. tagging a photo `halloween` puts it in the Halloween filters too.
- **Filter names:** 1–30 characters (letters, digits, spaces, `-`, `'`), unique ignoring case, never `black`. No parentheses, so the status line can be read back.
- **A Favorites star** next to each item on the Tags section, as a shortcut for the `favorites` tag.
- **Tagging needs no PIN**; editing filters does.
- **Black outside every entry** reads `black (nothing scheduled until 5:00 PM)`. A filter with nothing in it logs `Nothing in Halloween kid yet (any of halloween, halloween-kid). Showing black until something is tagged.` once.
