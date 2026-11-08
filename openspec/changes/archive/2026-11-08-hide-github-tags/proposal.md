# Proposal

## Why

Under Play, the tags list includes the GitHub videos' tags (`halloween`, `halloween-grownup`, `thanksgiving`), which repeat what the GitHub filters already offer and crowd the person's own tags. The person wants tags that are part of the GitHub schedules kept out of the Play area: those videos are played through their GitHub filters.

## What Changes

- **Play's tags leave out every tag a GitHub filter names** (in its "any of" or "except"). With today's GitHub filters that hides `halloween`, `halloween-kid`, `halloween-grownup` and `thanksgiving`, leaving tags like `favorites`, `upload` and the person's own.
- A tag no GitHub filter names is still offered, even a GitHub folder's (a new `christmas` folder shows until a GitHub filter names it).
- `GET /api/choices` gives just those tags. The filters row is unchanged, so the GitHub videos still play from Halloween kid, Halloween grownup and Thanksgiving.
- Unchanged: `POST /api/show` still plays any tag in use; the filter editor still lists every tag in use; custom filters' tags are not hidden.

## Capabilities

### New Capabilities

### Modified Capabilities
- `override-website`: the Play section's tags leave out those the GitHub filters name.

## Impact

- `scheduler/website.js` (`choices`), `scheduler/tests/website.test.js`, README and the window-display-schedule skill.
