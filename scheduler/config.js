// What plays when, and the box's settings. This is the file to edit for
// seasons and times. After changing it, rerun setup on the box:
//   cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh
'use strict';

module.exports = {
  // Which season folder plays on which days. On a day no season covers, the
  // screen stays black. If seasons overlap, the first one listed wins. With
  // an empty list, playlist folders sit directly in the video folder
  // (e.g. ~/video-scheduler/kid) and play all year.
  //   from, to   first and last day, both inclusive. A season can wrap the
  //              new year (from: '12-15', to: '01-06').
  //   days       optional: only these weekdays between from and to,
  //              e.g. ['fri', 'sat'].
  //   alsoOn     optional: extra days that play whatever the weekday, even
  //              outside from..to.
  // A day is written 'MM-DD' ('11-25'), or as the nth weekday of a month so
  // it's right every year: '11-4thu' is the 4th Thursday in November
  // (Thanksgiving), '05-lastmon' the last Monday in May. Add or subtract
  // days with +N or -N: '11-4thu-1' is the day before Thanksgiving. In
  // alsoOn, a one-off day can be given with its year: '2026-11-14'.
  seasons: [
    { name: 'halloween', from: '10-01', to: '10-31' },
    // Friday and Saturday until Thanksgiving, then the day before and the day itself.
    {
      name: 'thanksgiving',
      from: '11-01',
      to: '11-4thu',
      days: ['fri', 'sat'],
      alsoOn: ['11-4thu-1', '11-4thu'],
    },
    { name: 'christmas', from: '12-01', to: '12-31' },
  ],

  // When the screen is on each day: 24-hour HH:MM times. During a period,
  // the videos directly in today's season folder play, plus any in its
  // subfolder named after `playlist` (e.g. halloween/grownup/). The subfolder
  // is optional. Periods can cross midnight. If periods overlap, the first
  // one listed wins. A period can be limited to some weekdays with
  // days: ['sat', 'sun'] (a period that crosses midnight belongs to the day
  // it starts on).
  schedule: [
    { start: '05:00', stop: '07:00', playlist: 'kid' },
    { start: '17:00', stop: '19:30', playlist: 'kid' },
    { start: '19:30', stop: '23:00', playlist: 'grownup' },
  ],

  videoExtensions: ['mp4', 'm4v', 'mov'],
  checkSeconds: 1,

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
