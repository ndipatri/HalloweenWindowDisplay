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
  // `upload`, and play from that tag under Play on the website, or in any
  // filter with one of their tags. A repo folder called photos is left alone by sync.
  photoSeconds: 10, // how long each photo stays on screen
  photoExtensions: ['jpg', 'jpeg', 'png'], // photo files, which only uploads can be
  uploads: {
    maxBytes: 1024 ** 3, // at most 1 GB a file
    keepFreeBytes: 2 * 1024 ** 3, // refuse an upload that would leave under 2 GB free
    pinTries: 5, // wrong upload PINs in a row before uploads lock...
    lockMinutes: 5, // ...for this long
  },

  // A QR code of the website's address (http://<the box's address>/) kept
  // in the TV's bottom-right corner whenever something plays, so phones
  // that can't open tvbox.local can scan it. Switched on and off under TV
  // on the website.
  addressCode: {
    size: 120, // at most this many pixels square
    margin: 24, // pixels from the edges
  },

  box: {
    // Videos, the status file, the override and the log live here. Default:
    // ~/video-scheduler for the user setup.sh was run for.
    videoRoot: null,
    // How far mpv turns the picture for a TV standing on its side (portrait,
    // as chosen under TV on the website, and with nothing chosen): 90 or
    // 270 (0 for a TV the normal way up). If it comes out upside down,
    // switch between 90 and 270.
    rotate: 270,
    // The same, for when the TV is turned to landscape on its mount (chosen
    // under TV on the website): 0, or 180 if it comes out upside down.
    landscapeRotate: 0,
    // A tilt switch on the back of the TV, so the box notices by itself when
    // the TV is turned (see the README). null: none, and the TV buttons on
    // the website are the only way. Once one is wired between GPIO17
    // (pin 11) and ground (pin 9): { gpio: 17, closed: 'portrait' }, where
    // `closed` is the way the TV faces while the switch is closed.
    tiltSwitch: { gpio: 17, closed: 'landscape' },
    // The website: http://<the box's name>.local/ (port 80 needs no number).
    webPort: 80,
    // systemd-timesyncd creates this once the clock is set from the network.
    clockFile: '/run/systemd/timesync/synchronized',
    // mpv's control socket (systemd's RuntimeDirectory=tvbox makes /run/tvbox).
    mpvSocket: '/run/tvbox/mpv.sock',
  },
};
