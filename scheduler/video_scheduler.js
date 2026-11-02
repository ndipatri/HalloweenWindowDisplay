ObjC.import('Cocoa');
ObjC.import('AVFoundation');
ObjC.import('AVKit');
ObjC.import('stdlib');

const HOME = ObjC.unwrap($.NSHomeDirectory());

const CONFIG = {
  // Videos live in season folders in here, e.g. ~/video-scheduler/halloween.
  // Keep it out of Desktop, Documents and Downloads: macOS can silently block
  // a background script from reading them.
  videoRoot: HOME + '/video-scheduler',

  // Which season folder plays on which days. On a day no season covers, the
  // screen stays black. If seasons overlap, the first one listed wins. With
  // an empty list, playlist folders sit directly in videoRoot
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
};

// Written by the `show` command to override the schedule; checked every second.
const OVERRIDE_PATH = CONFIG.videoRoot + '/override.json';
// One line saying what's on screen and why; `show` prints it.
const STATUS_PATH = CONFIG.videoRoot + '/status';

const ITEM_FAILED = 2;
const PLAYER_FAILED = 2;
// Videos queued ahead of time, so one follows the next without a gap.
const QUEUE_AHEAD = 3;

function main() {
  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);

  const window = createBlackWindow();
  const view = createPlayerView();
  window.contentView.addSubview(view);
  $.NSCursor.hide;

  const schedule = validSchedule(CONFIG.schedule);
  const seasons = validSeasons(CONFIG.seasons);
  log('Started. Videos: ' + CONFIG.videoRoot);
  log(
    seasons.length
      ? 'Seasons: ' + seasons.map(describeSeason).join('; ')
      : 'No seasons: playlists play all year.',
  );

  const playlists = {};
  const overrideState = { warnedText: null };
  let activeName;
  let active = null;
  let status = null;

  while (true) {
    keepOnPortraitScreen(app, window);

    const choice = whatToShow(schedule, seasons, new Date(), overrideState);
    if (choice.status !== status) {
      status = choice.status;
      log('Now showing: ' + status);
      writeText(STATUS_PATH, status + '\n');
    }

    const name = choice.playlist;
    if (name !== activeName) {
      if (active) active.player.pause;
      activeName = name;
      if (name) {
        if (!playlists[name]) playlists[name] = createPlaylist(name, seasons);
        active = playlists[name];
        view.player = active.player;
      } else {
        active = null;
      }
    }

    if (active) {
      const hasVideo = keepPlaying(active);
      if (active.replacedPlayer) {
        active.replacedPlayer = false;
        view.player = active.player;
      }
      view.hidden = !hasVideo;
      if (hasVideo && active.player.rate === 0) active.player.play;
    } else {
      view.hidden = true;
    }

    handleEventsFor(app, CONFIG.checkSeconds);
  }
}

// ---------- Schedule ----------

function validSchedule(periods) {
  return periods.filter((period, i) => {
    const ok =
      isTime(period.start) &&
      isTime(period.stop) &&
      typeof period.playlist === 'string' &&
      period.playlist.length > 0 &&
      !period.playlist.includes('/') &&
      (period.days === undefined || parseWeekdays(period.days) !== null);
    if (!ok) {
      log(
        'ERROR: Ignoring schedule entry ' + (i + 1) + ': ' + JSON.stringify(period) +
        ". Expected { start: 'HH:MM', stop: 'HH:MM', playlist: 'kid' }, optionally" +
        " with days: ['fri', 'sat'].",
      );
    }
    return ok;
  }).map((period) =>
    period.days === undefined ? period : Object.assign({}, period, { weekdays: parseWeekdays(period.days) }),
  );
}

function isTime(value) {
  return typeof value === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(value);
}

function activePlaylistName(schedule, now) {
  const current = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const yesterday = (today + 6) % 7;
  const on = (p, weekday) => !p.weekdays || p.weekdays.includes(weekday);
  const period = schedule.find((p) => {
    const start = toMinutes(p.start);
    const stop = toMinutes(p.stop);
    if (start <= stop) return current >= start && current < stop && on(p, today);
    // Crosses midnight: the part after midnight belongs to yesterday's period.
    return (current >= start && on(p, today)) || (current < stop && on(p, yesterday));
  });
  return period ? period.playlist : null;
}

function toMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

// ---------- Seasons ----------

// Checks each season and adds parsed versions of its days: fromDay/toDay
// and each of alsoOnDays are functions from a year to { year, month, day }
// (null if there's no such day that year), weekdays a list of 0-6 (Sunday 0).
function validSeasons(seasons) {
  const out = [];
  (seasons || []).forEach((season, i) => {
    const error = seasonError(season);
    if (error) {
      log(
        'ERROR: Ignoring season entry ' + (i + 1) + ': ' + JSON.stringify(season) +
        ': ' + error + ". Expected { name: 'halloween', from: 'MM-DD', to: 'MM-DD' }," +
        " optionally with days: ['fri', 'sat'] and alsoOn: ['11-4thu'].",
      );
      return;
    }
    out.push(Object.assign({}, season, {
      fromDay: parseDay(season.from, false),
      toDay: parseDay(season.to, false),
      weekdays: season.days === undefined ? null : parseWeekdays(season.days),
      alsoOnDays: (season.alsoOn || []).map((d) => parseDay(d, true)),
    }));
  });
  return out;
}

function seasonError(season) {
  if (!season || typeof season !== 'object') return 'not an object';
  if (!isFolderName(season.name)) return 'bad name';
  if (!parseDay(season.from, false)) return 'bad from';
  if (!parseDay(season.to, false)) return 'bad to';
  if (season.days !== undefined && parseWeekdays(season.days) === null) return 'bad days';
  if (season.alsoOn !== undefined) {
    if (!Array.isArray(season.alsoOn)) return 'alsoOn should be a list';
    const bad = season.alsoOn.find((d) => !parseDay(d, true));
    if (bad !== undefined) return 'bad alsoOn day ' + JSON.stringify(bad);
  }
  return null;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ['fri', 'Saturday'] -> [5, 6]; null if anything isn't a weekday.
function parseWeekdays(days) {
  if (!Array.isArray(days) || days.length === 0) return null;
  const full = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const out = [];
  for (const d of days) {
    const name = typeof d === 'string' ? d.trim().toLowerCase() : '';
    const n = WEEKDAYS.includes(name) ? WEEKDAYS.indexOf(name) : full.indexOf(name);
    if (n < 0) return null;
    out.push(n);
  }
  return out;
}

// Parses a day written as 'MM-DD', 'MM-<n><weekday>' ('11-4thu', '05-lastmon'),
// either with an optional '+N'/'-N' days, or (if withYear) 'YYYY-MM-DD'.
// Returns a function from a year to { year, month, day } (null if the day
// doesn't exist that year, e.g. 02-29), or null if the text is invalid.
function parseDay(text, withYear) {
  if (typeof text !== 'string') return null;
  const t = text.trim().toLowerCase();
  let m = withYear && /^(\d{4})-(\d\d)-(\d\d)$/.exec(t);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!isMonthDay(m[2] + '-' + m[3])) return null;
    return (year) => (year === y && validDate(y, mo, d) ? { year: y, month: mo, day: d } : null);
  }
  m = /^(\d\d)-(\d\d|[1-5](?:st|nd|rd|th)?|last)(sun|mon|tue|wed|thu|fri|sat)?([+-]\d+)?$/.exec(t);
  if (!m) return null;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return null;
  const offset = m[4] ? Number(m[4]) : 0;
  let base;
  if (/^\d\d$/.test(m[2]) && m[3] === undefined) {
    if (!isMonthDay(m[1] + '-' + m[2])) return null;
    const day = Number(m[2]);
    base = (year) => (validDate(year, month, day) ? new Date(year, month - 1, day) : null);
  } else {
    if (m[3] === undefined || /^\d\d$/.test(m[2])) return null;
    const weekday = WEEKDAYS.indexOf(m[3]);
    const nth = m[2] === 'last' ? -1 : parseInt(m[2], 10);
    base = (year) => nthWeekday(year, month, nth, weekday);
  }
  return (year) => {
    const d = base(year);
    if (!d) return null;
    d.setDate(d.getDate() + offset);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  };
}

function validDate(year, month, day) {
  const d = new Date(year, month - 1, day);
  return d.getMonth() === month - 1;
}

// The nth (1-5, or -1 for last) given weekday of a month, or null.
function nthWeekday(year, month, nth, weekday) {
  if (nth === -1) {
    const d = new Date(year, month, 0); // last day of the month
    d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
    return d;
  }
  const d = new Date(year, month - 1, 1);
  d.setDate(1 + ((weekday - d.getDay() + 7) % 7) + (nth - 1) * 7);
  return d.getMonth() === month - 1 ? d : null;
}

function describeSeason(s) {
  let text = s.name + ' ' + s.from + '..' + s.to;
  if (s.days) text += ' ' + s.days.join('/');
  if (s.alsoOn && s.alsoOn.length) text += ' plus ' + s.alsoOn.join(', ');
  return text;
}

function isFolderName(value) {
  return typeof value === 'string' && /^[^/.][^/]*$/.test(value);
}

function isMonthDay(value) {
  if (typeof value !== 'string' || !/^\d\d-\d\d$/.test(value)) return false;
  const [month, day] = value.split('-').map(Number);
  const daysIn = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysIn[month - 1];
}

// The season covering `date`, or null. A season covers a day in from..to
// (inclusive; a season whose `to` is before its `from` wraps the new year)
// that is one of its `days`, and every day in `alsoOn`.
function activeSeason(seasons, date) {
  const season = seasons.find((s) => seasonCovers(s, date));
  return season ? season.name : null;
}

function seasonCovers(s, date) {
  const year = date.getFullYear();
  const today = (date.getMonth() + 1) * 100 + date.getDate();
  const sameDay = (d) =>
    d && d.year === year && d.month * 100 + d.day === today;
  if (s.alsoOnDays.some((f) => sameDay(f(year)))) return true;
  if (s.weekdays && !s.weekdays.includes(date.getDay())) return false;
  // from and to as month-day numbers in this year (a nth-weekday day
  // moves from year to year). A day with an offset that lands in another
  // year (e.g. '01-01-1') is taken by its month and day.
  const from = s.fromDay(year);
  const to = s.toDay(year);
  if (!from || !to) return false; // e.g. 02-29 in a year without one
  const f = from.month * 100 + from.day;
  const t = to.month * 100 + to.day;
  return f <= t ? today >= f && today <= t : today >= f || today <= t;
}

// Turns a playlist name into what to play: 'kid' becomes today's season
// plus kid, e.g. 'halloween/kid'. A season name ('christmas') or an explicit
// 'season/playlist' is used as given. Null means black: nothing asked for,
// or no season today. Without seasons, names are used as they are.
function resolve(name, seasons, date) {
  if (name === null) return null;
  if (!seasons.length || name.includes('/')) return name;
  if (seasons.some((s) => s.name === name)) return name;
  const season = activeSeason(seasons, date);
  return season ? season + '/' + name : null;
}

// The folders (relative to videoRoot) whose videos make up `key`:
// 'halloween/grownup' plays halloween/ plus halloween/grownup/.
function foldersFor(key, seasons) {
  if (!seasons.length) return [key];
  const slash = key.indexOf('/');
  return slash < 0 ? [key] : [key.slice(0, slash), key];
}

// What the schedule plays at `date`: 'halloween/kid', or null for black.
function scheduledKey(schedule, seasons, date) {
  return resolve(activePlaylistName(schedule, date), seasons, date);
}

// When what the schedule plays next differs from what it plays at `from`,
// to the minute: a period starting or ending, or the season changing at
// midnight. null if it doesn't change within a day.
function nextScheduleChange(schedule, seasons, from) {
  const current = scheduledKey(schedule, seasons, from);
  const t = new Date(from.getTime());
  t.setSeconds(0, 0);
  for (let i = 0; i < 24 * 60; i++) {
    t.setMinutes(t.getMinutes() + 1);
    if (scheduledKey(schedule, seasons, t) !== current) return new Date(t.getTime());
  }
  return null;
}

// ---------- What to show: override or schedule ----------

// Returns { playlist, status }: what to play ('halloween/kid', or null for
// black) and a one-line description of what's showing and why.
function whatToShow(schedule, seasons, now, overrideState) {
  const override = currentOverride(schedule, seasons, now, overrideState);
  if (override) {
    const key = resolve(override.playlist, seasons, now);
    const noSeason = override.playlist !== null && key === null;
    return {
      playlist: key,
      status:
        describe(key) + ' (override ' + override.until +
        (noSeason ? '; asked for ' + override.playlist + ' but no season today' : '') + ')',
    };
  }
  const playlist = activePlaylistName(schedule, now);
  const change = nextScheduleChange(schedule, seasons, now);
  const until = change ? 'until ' + formatTime(change, now) : 'all day';
  if (!playlist) {
    return { playlist: null, status: 'black (outside schedule ' + until + ')' };
  }
  const key = resolve(playlist, seasons, now);
  return {
    playlist: key,
    status: key
      ? key + ' (scheduled ' + until + ')'
      : 'black (no season today, ' + formatDay(now) + ')',
  };
}

function describe(playlist) {
  return playlist === null ? 'black' : playlist;
}

function formatDay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Reads the override file. Ends an override whose time is up by deleting
// the file. Returns { playlist, until } while one is in force, else null.
function currentOverride(schedule, seasons, now, state) {
  const text = readText(OVERRIDE_PATH);
  if (text === null) return null;

  const parsed = parseOverride(text);
  if (!parsed.ok) {
    if (state.warnedText !== text) {
      state.warnedText = text;
      log('ERROR: Ignoring ' + OVERRIDE_PATH + ': ' + parsed.error);
    }
    return null;
  }

  const decision = decideOverride(parsed.value, schedule, seasons, now);
  if (!decision.active) {
    // Only delete it if `show` hasn't just replaced it with a new one.
    if (readText(OVERRIDE_PATH) === text) removeFile(OVERRIDE_PATH);
    log('Override of ' + describe(parsed.value.playlist) + ' ended: ' + decision.reason + '.');
    return null;
  }
  return {
    playlist: parsed.value.playlist,
    until: decision.endsAt
      ? (decision.atScheduleChange ? 'until the schedule changes at ' : 'until ') +
        formatTime(decision.endsAt, now)
      : 'until cleared',
  };
}

// Override file, as written by `show`:
//   { "playlist": "grownup" | "christmas" | "christmas/grownup" | null,
//     "setAt": <ms>, "expires": <ms> | null, "untilCleared": true | false }
// playlist null means black; a plain playlist name means today's season's.
// With no `expires` and untilCleared false, the override lasts until the
// schedule next changes after `setAt`.
function parseOverride(text) {
  let o;
  try {
    o = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'not valid JSON' };
  }
  if (o === null || typeof o !== 'object') return { ok: false, error: 'not an object' };
  const playlistOk =
    o.playlist === null ||
    (typeof o.playlist === 'string' &&
      /^[^/.][^/]*(\/[^/.][^/]*)?$/.test(o.playlist));
  if (!playlistOk) return { ok: false, error: 'bad "playlist"' };
  if (typeof o.setAt !== 'number') return { ok: false, error: 'bad "setAt"' };
  if (o.expires !== null && o.expires !== undefined && typeof o.expires !== 'number') {
    return { ok: false, error: 'bad "expires"' };
  }
  return {
    ok: true,
    value: {
      playlist: o.playlist,
      setAt: o.setAt,
      expires: typeof o.expires === 'number' ? o.expires : null,
      untilCleared: o.untilCleared === true,
    },
  };
}

// { active: true, endsAt: Date | null, atScheduleChange } or
// { active: false, reason }.
function decideOverride(o, schedule, seasons, now) {
  if (o.untilCleared) return { active: true, endsAt: null, atScheduleChange: false };
  if (o.expires !== null) {
    return now.getTime() >= o.expires
      ? { active: false, reason: 'time is up' }
      : { active: true, endsAt: new Date(o.expires), atScheduleChange: false };
  }
  const change = nextScheduleChange(schedule, seasons, new Date(o.setAt));
  if (change === null) return { active: true, endsAt: null, atScheduleChange: false };
  return now.getTime() >= change.getTime()
    ? { active: false, reason: 'the schedule changed' }
    : { active: true, endsAt: change, atScheduleChange: true };
}

// "8:00 PM", or "Sat 8:00 PM" when it isn't today.
function formatTime(date, now) {
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return time;
  return date.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + time;
}

// ---------- Playlists ----------

// `name` is what resolve() returned, e.g. 'halloween/grownup'. The first
// folder must exist; the rest (a season's playlist subfolder) are optional.
function createPlaylist(name, seasons) {
  return {
    name,
    folders: foldersFor(name, seasons).map((f) => CONFIG.videoRoot + '/' + f),
    player: newQueuePlayer(),
    replacedPlayer: false,
    lastQueued: null,
    nowPlaying: null,
    warnings: {},
  };
}

function newQueuePlayer() {
  return $.NSClassFromString('AVQueuePlayer').alloc.init;
}

// Keeps the playlist's queue topped up, cycling through its folders' videos
// in name order. Re-reads the folders each time, so added or removed videos
// are picked up without a restart. Returns whether there is anything to show.
function keepPlaying(playlist) {
  if (playlist.player.status === PLAYER_FAILED) {
    log(
      'ERROR: The ' + playlist.name + ' player stopped working (' +
      errorText(playlist.player.error) + '). Starting a new one.',
    );
    playlist.player = newQueuePlayer();
    playlist.replacedPlayer = true;
    playlist.nowPlaying = null;
  }

  const current = playlist.player.currentItem;
  if (!current.isNil() && current.status === ITEM_FAILED) {
    warnOnce(
      playlist,
      'bad:' + fileName(current),
      'ERROR: Skipping ' + fileName(current) + ' in ' + playlist.name + ': ' +
        errorText(current.error),
    );
    playlist.player.advanceToNextItem;
  }

  const playing = playlist.player.currentItem;
  const playingName = playing.isNil() ? null : fileName(playing);
  if (playingName && playingName !== playlist.nowPlaying) {
    log(playlist.name + ': playing ' + playingName);
  }
  playlist.nowPlaying = playingName;

  let queued = playlist.player.items.count;
  if (queued >= QUEUE_AHEAD) return true;

  const videos = listVideos(playlist.folders);
  if (videos === null) {
    warnOnce(
      playlist,
      'missing',
      'No folder ' + playlist.folders[0] + ', so showing black. If it should ' +
        'have videos, add it to the repo\'s playlists/ and run sync.',
    );
    return queued > 0;
  }
  clearWarning(playlist, 'missing');
  if (videos.length === 0) {
    warnOnce(
      playlist,
      'empty',
      'No videos for ' + playlist.name + ' yet (looked in ' +
        playlist.folders.join(' and ') + '). Showing black until one is added.',
    );
    return queued > 0;
  }
  clearWarning(playlist, 'empty');

  while (queued < QUEUE_AHEAD) {
    const video = nextVideo(videos, playlist.lastQueued);
    const url = $.NSURL.fileURLWithPath(video.path);
    const item = $.NSClassFromString('AVPlayerItem').playerItemWithURL(url);
    appendToQueue(playlist.player, item);
    playlist.lastQueued = video;
    queued++;
  }
  return true;
}

// Adds an item to the end of the player's queue.
// Don't use insertItem:afterItem: with null to mean "at the end": the
// JavaScript bridge passes null as an NSNull object, not nil, and
// AVFoundation crashes on it ("-[NSNull _nameForLogging]: unrecognized
// selector"). Insert after the actual last item, or, when the queue is empty,
// make the item the current one.
function appendToQueue(player, item) {
  const items = player.items;
  if (items.count === 0) {
    player.replaceCurrentItemWithPlayerItem(item);
  } else {
    player.insertItemAfterItem(item, items.lastObject);
  }
}

// The videos in `folders`, as { name, path }, sorted by name. null if the
// first folder can't be read; later folders are optional.
function listVideos(folders) {
  const videos = [];
  for (let i = 0; i < folders.length; i++) {
    const names = listFolder(folders[i]);
    if (names === null) {
      if (i === 0) return null;
      continue;
    }
    names
      .filter(isVideoFile)
      .forEach((name) => videos.push({ name, path: folders[i] + '/' + name }));
  }
  return videos.sort(compareVideos);
}

function listFolder(folder) {
  const contents = $.NSFileManager.defaultManager.contentsOfDirectoryAtPathError(
    folder,
    null,
  );
  return contents.isNil() ? null : ObjC.deepUnwrap(contents);
}

function isVideoFile(name) {
  if (name.startsWith('.') || !name.includes('.')) return false;
  const extension = name.split('.').pop().toLowerCase();
  return CONFIG.videoExtensions.includes(extension);
}

// Name order, with numbers compared as numbers: 2-ghost.mp4 before 10-hand.mp4.
function compareNames(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

// By file name, then by folder, so the same name in two folders has a fixed order.
function compareVideos(a, b) {
  return compareNames(a.name, b.name) || compareNames(a.path, b.path);
}

// The video after `last` in name order, wrapping round to the first.
function nextVideo(videos, last) {
  if (last === null) return videos[0];
  return videos.find((video) => compareVideos(video, last) > 0) || videos[0];
}

function fileName(item) {
  return ObjC.unwrap(item.asset.URL.lastPathComponent);
}

function errorText(error) {
  return error.isNil() ? 'unknown reason' : ObjC.unwrap(error.localizedDescription);
}

// ---------- Files ----------

function readText(path) {
  const text = $.NSString.stringWithContentsOfFileEncodingError(
    path,
    $.NSUTF8StringEncoding,
    null,
  );
  return text.isNil() ? null : ObjC.unwrap(text);
}

function writeText(path, text) {
  $(text).writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
}

function removeFile(path) {
  $.NSFileManager.defaultManager.removeItemAtPathError(path, null);
}

// ---------- Logging ----------

function log(message) {
  // osascript sends console.log to stderr, which the launch agent saves to a file.
  console.log(new Date().toLocaleString() + '  ' + message);
}

function warnOnce(playlist, key, message) {
  if (playlist.warnings[key]) return;
  playlist.warnings[key] = true;
  log(message);
}

function clearWarning(playlist, key) {
  delete playlist.warnings[key];
}

// ---------- Window and display ----------

function handleEventsFor(app, seconds) {
  const until = $.NSDate.dateWithTimeIntervalSinceNow(seconds);
  while (true) {
    const event = app.nextEventMatchingMaskUntilDateInModeDequeue(
      -1,
      until,
      $.NSDefaultRunLoopMode,
      true,
    );
    if (event.isNil()) return;
    if (isControlC(event)) {
      log('Quit with Control-C.');
      $.exit(0);
    }
    app.sendEvent(event);
  }
}

function isControlC(event) {
  const keyDown = 10;
  const controlFlag = 1 << 18;
  return (
    event.type == keyDown &&
    (event.modifierFlags & controlFlag) !== 0 &&
    ObjC.unwrap(event.charactersIgnoringModifiers) === 'c'
  );
}

let portraitMissing = null;

function keepOnPortraitScreen(app, window) {
  const screen = portraitScreen();
  if (portraitMissing !== !screen) {
    portraitMissing = !screen;
    log(
      screen
        ? 'Using the portrait display.'
        : 'No portrait display found: is the TV connected, and rotated to ' +
            'portrait in System Settings > Displays?',
    );
  }
  if (!screen) {
    if (window.isVisible) window.orderOut(null);
    return;
  }
  if (!window.isVisible || !sameRect(window.frame, screen.frame)) {
    window.setFrameDisplay(screen.frame, true);
    window.makeKeyAndOrderFront(null);
    app.activateIgnoringOtherApps(true);
  }
}

function portraitScreen() {
  const screens = $.NSScreen.screens;
  for (let i = 0; i < screens.count; i++) {
    const screen = screens.objectAtIndex(i);
    const size = screen.frame.size;
    if (size.height > size.width) return screen;
  }
  return null;
}

function sameRect(a, b) {
  return (
    a.origin.x === b.origin.x &&
    a.origin.y === b.origin.y &&
    a.size.width === b.size.width &&
    a.size.height === b.size.height
  );
}

function createBlackWindow() {
  ObjC.registerSubclass({
    name: 'SchedulerWindow',
    superclass: 'NSWindow',
    methods: {
      canBecomeKeyWindow: {
        types: ['bool', []],
        implementation: () => true,
      },
    },
  });
  const window = $.SchedulerWindow.alloc.initWithContentRectStyleMaskBackingDefer(
    $.NSMakeRect(0, 0, 1080, 1920),
    $.NSWindowStyleMaskBorderless,
    $.NSBackingStoreBuffered,
    false,
  );
  window.backgroundColor = $.NSColor.blackColor;
  window.level = 1000;
  window.collectionBehavior =
    $.NSWindowCollectionBehaviorCanJoinAllSpaces |
    $.NSWindowCollectionBehaviorStationary |
    $.NSWindowCollectionBehaviorFullScreenAuxiliary;
  window.releasedWhenClosed = false;
  return window;
}

function createPlayerView() {
  const view = $.NSClassFromString('AVPlayerView').alloc.initWithFrame(
    $.NSMakeRect(0, 0, 1080, 1920),
  );
  view.autoresizingMask = $.NSViewWidthSizable | $.NSViewHeightSizable;
  view.controlsStyle = 0;
  view.videoGravity = 'AVLayerVideoGravityResizeAspect';
  view.hidden = true;
  return view;
}

main();
