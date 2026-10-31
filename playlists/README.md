# Playlists

One folder per playlist, named as in the schedule: `kid/`, `grownup/`, or any other name.

The Mac copies these into `~/video-scheduler/<playlist>/` at every login, or when you run `~/video-scheduler/sync`. This folder is the master copy: once a playlist folder exists here, videos on the Mac that aren't in it are moved to `~/video-scheduler/.removed/`.

- `.mp4`, `.m4v` or `.mov`, 1080 × 1920 portrait, under 100 MB each (GitHub's limit).
- They play in file-name order; a number prefix (`1-`, `2-`, …) sets the order.
- Videos that start and end on black loop without a visible jump.

See the main [README](../README.md#3-add-the-videos).
