# Proposal

## Why

The person wants GitHub to be the only place that decides a repo video's tags. Today the website lists every item under Tags and lets the box add its own tags to repo videos too, so the same video can be tagged differently on each box. Keeping box tags to uploads makes a repo video's tags the same everywhere: its folder.

## What Changes

- **Box tags are for uploads only.** The website adds and removes tags (☆ `favorites` included) only on photos and videos added on the website. Asked to tag a video from GitHub, it refuses: `halloween/fuzzy.mp4 comes from GitHub: its tag comes from its folder there.`
- **The Tags section lists only uploads**, each with its tags, ☆, × and add-a-tag. Repo videos aren't listed there. Their folder tags still appear in the filter editor's tick lists, as the website's list of tags in use still includes them.
- **Box tags already given to repo videos** (in `tags.json`, e.g. from the old My picks) are ignored by filters and the page, and dropped the next time the tags are saved.
- **Moving over from My picks:** only uploads among the old picks become `favorites`.
- **Consequence, agreed with the person:** Favorites, and any filter on the box's own tags, only ever holds uploads. To group repo videos differently, change their folders in GitHub.
- Unchanged: folder tags, filters, schedules, the starting filters, uploads and their PIN.

## Capabilities

### New Capabilities

### Modified Capabilities
- `tags`: box tags only on uploads; the website lists only uploads; box tags on repo videos are ignored and dropped; only uploads among old picks become favorites.
- `filters`: the scenarios that used box tags on repo videos use uploads.
- `override-website`: the page's Tags section lists only uploads.

## Impact

- `scheduler/logic.js`: `items()` gives repo videos no box tags.
- `scheduler/website.js`: `/api/tags` refuses repo videos; `/api/items` lists only uploads (tags in use still counts every item); saving tags keeps only uploads' entries; the picks move-over keeps only uploads; the page's Tags hint.
- Tests: `scheduler.test.js`, `player.test.js`, `website.test.js`. The rehearsal's tag checks use uploads.
- README (Favorites and tags) and the window-display-schedule skill.
- On the box: rerun setup (code under `scheduler/` changed).

## Product decisions

From the person: only uploads are shown under Tags, and items from GitHub can't be tagged on the website; confirmed knowing Favorites then holds only uploads.

## Assumed product decisions

Mine; change any of them.
- The refusal's wording, as above.
- Box tags on repo videos are dropped quietly on the next save, without a log line for each.
