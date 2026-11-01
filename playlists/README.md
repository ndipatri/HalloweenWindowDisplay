# Playlists

One folder per season, named as in `CONFIG.seasons` in `scheduler/video_scheduler.js` (`halloween`, `thanksgiving`, `christmas`, …). The season's dates decide when its videos play.

```
halloween/            videos here play in every scheduled period of the season
└── grownup/          optional: only during 'grownup' periods (any playlist name from the schedule works)
```

The Mac copies these into `~/video-scheduler/` at every login, or when you run `~/video-scheduler/sync`. This folder is the master copy: once a season folder exists here, videos in that season on the Mac that aren't in it are moved to `~/video-scheduler/.removed/`.

- `.mp4`, `.m4v` or `.mov`, 1080 × 1920 portrait, under 100 MB each (GitHub's limit).
- They play in file-name order, season and subfolder videos mixed; a number prefix (`1-`, `2-`, …) sets the order.
- Videos that start and end on black loop without a visible jump.

See the main [README](../README.md#3-add-the-videos).
