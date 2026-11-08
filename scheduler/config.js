// The box's settings. After changing them, rerun setup on the box:
//   cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh
'use strict';

module.exports = {
  // What plays when is no longer set here: filters (tags to play, and days
  // and times) come from the repo's playlists/filters.json (copied to each box
  // by sync), plus each box's own custom filters, edited under Filters on its
  // website (~/video-scheduler/filters.json). Videos get a tag from their folder in
  // playlists/ (halloween/kid -> halloween-kid).

  videoExtensions: ['mp4', 'm4v', 'mov'],
  checkSeconds: 1,

  // Photos and videos added from a phone on the website. They live in
  // ~/video-scheduler/photos on the box (never in the repo), are all tagged
  // `upload`, and play in any filter with one of their tags (All uploads, to
  // start with). A repo folder called photos is left alone by sync.
  photoSeconds: 10, // how long each photo stays on screen
  photoExtensions: ['jpg', 'jpeg', 'png'], // photo files, which only uploads can be
  uploads: {
    maxBytes: 1024 ** 3, // at most 1 GB a file
    keepFreeBytes: 2 * 1024 ** 3, // refuse an upload that would leave under 2 GB free
    pinTries: 5, // wrong upload PINs in a row before uploads lock...
    lockMinutes: 5, // ...for this long
  },

  box: {
    // Videos, the status file, the override and the log live here. Default:
    // ~/video-scheduler for the user setup.sh was run for.
    videoRoot: null,
    // How far mpv turns the picture for a TV standing on its side: 90 or
    // 270 (0 for a TV the normal way up). If it comes out upside down,
    // switch between 90 and 270.
    rotate: 90,
    // The website: http://<the box's name>.local/ (port 80 needs no number).
    webPort: 80,
    // systemd-timesyncd creates this once the clock is set from the network.
    clockFile: '/run/systemd/timesync/synchronized',
    // mpv's control socket (systemd's RuntimeDirectory=tvbox makes /run/tvbox).
    mpvSocket: '/run/tvbox/mpv.sock',
  },
};
