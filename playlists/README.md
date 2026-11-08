# Playlists

One folder per season (`halloween`, `thanksgiving`, …). Each folder gives its videos a tag: `halloween/` → `halloween`, `halloween/grownup/` → `halloween-grownup`.

```
halloween/            tag: halloween
└── grownup/          tag: halloween-grownup
filters.json          the filters every box shares: which tags play on which days and at which times
```

`filters.json` holds the shared filters (Halloween kid, Halloween grownup, Thanksgiving, Favorites, All uploads). Each one names the tags it plays (`anyOf`, and optionally `except`) and its days and times; see the window-display-schedule skill for the format. A change here reaches every box with its next sync. Each box can also have its own custom filters, made on its website, which win over these.

The box copies these into `~/video-scheduler/` a minute after it starts and then every hour. This folder is the master copy: once a season folder exists here, videos in that season on the box that aren't in it are moved to `~/video-scheduler/.removed/`.

- `.mp4`, `.m4v` or `.mov`, 1080 × 1920 portrait, under 100 MB each (GitHub's limit).
- A filter plays its videos in file-name order, all its folders mixed; a number prefix (`1-`, `2-`, …) sets the order.
- Videos that start and end on black loop without a visible jump.

See the main [README](../README.md).
