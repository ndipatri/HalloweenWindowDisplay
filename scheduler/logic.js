// The scheduler's logic: seasons, the daily schedule, overrides, and the
// playlist queue in mpv. Moved from the Mac's JXA script function by
// function; only the file access (now `io`) and the playback (now mpv) changed.
// Used by player.js and website.js on the box, and by the tests with fakes.
'use strict';

// `io`: { config, videoRoot, readText(path) -> text or null,
//          writeText(path, text), removeFile(path),
//          listFolder(path) -> [names] or null, log(message) }
function createScheduler(io) {
  const CONFIG = io.config;
  const { readText, writeText, removeFile, listFolder, log } = io;
  const videoRoot = io.videoRoot;

  // Written by the website to override the schedule; checked every second.
  const OVERRIDE_PATH = videoRoot + '/override.json';
  // One line saying what's on screen and why; the website shows it.
  const STATUS_PATH = videoRoot + '/status';

  // Videos queued ahead of time, so one follows the next without a gap.
  const QUEUE_AHEAD = 3;

  // The uploads from the website: their own folder and their own choice.
  const PHOTOS = 'photos';
  const NO_UPLOADS = 'No photos or videos uploaded yet. Showing black until one is added.';

  // My picks: items chosen on the website from the season folders and the
  // uploads, kept in order in picks.json, and played as their own choice.
  const PICKS = 'picks';
  const PICKS_PATH = videoRoot + '/picks.json';
  const NO_PICKS = 'Nothing picked yet. Showing black until something is ticked in My picks.';

  // ---------- Schedule ----------

  function validSchedule(periods) {
    return periods.filter((period, i) => {
      if (period && (period.playlist === PHOTOS || period.playlist === PICKS)) {
        log(
          'ERROR: Ignoring schedule entry ' + (i + 1) + ': ' + JSON.stringify(period) +
          ': ' + period.playlist + ' plays only when chosen on the website, never on the schedule.',
        );
        return false;
      }
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
    if (season.name === PHOTOS) return 'the name photos is kept for uploads from the website';
    if (season.name === PICKS) return 'the name picks is kept for My picks on the website';
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
    if (name === PHOTOS || name === PICKS || !seasons.length || name.includes('/')) return name;
    if (seasons.some((s) => s.name === name)) return name;
    const season = activeSeason(seasons, date);
    return season ? season + '/' + name : null;
  }

  // The folders (relative to videoRoot) whose videos make up `key`:
  // 'halloween/grownup' plays halloween/ plus halloween/grownup/.
  function foldersFor(key, seasons) {
    if (key === PICKS) return [];
    if (key === PHOTOS || !seasons.length) return [key];
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
      // Only delete it if the website hasn't just replaced it with a new one.
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

  // Override file, as written by the website:
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
      folders: foldersFor(name, seasons).map((f) => videoRoot + '/' + f),
      photos: name === PHOTOS, // photo files play too
      ordered: name === PICKS, // plays picks.json in its own order, not by name
      order: [], // ordered: the items as last read, to find what follows a pick
      lastQueued: null, // the last video put in mpv's queue
      resumeAt: null, // when the playlist comes back: the video to start at
      nowPlaying: null, // the playing video, as { name, path }
      filesById: {}, // mpv playlist entry id -> path, to name failed videos
      warnings: {},
    };
  }

  // Keeps mpv's queue topped up with the playlist's videos, cycling through
  // its folders in name order. Re-reads the folders each time, so added or
  // removed videos are picked up without a restart. Returns whether there is
  // anything to show. `mpv` is the box's mpv (or the tests' fake):
  // command(...args), getProperty(name), takeEvents().
  async function keepPlaying(playlist, mpv) {
    // A video mpv failed on stays in its playlist (behind the current one)
    // until removed below, so read the playlist first: then every failure
    // can be named.
    let entries = (await mpv.getProperty('playlist')) || [];
    entries.forEach((e) => { playlist.filesById[e.id] = e.filename; });
    for (const e of mpv.takeEvents()) {
      if (e.event === 'end-file' && e.reason === 'error') {
        const path = playlist.filesById[e.playlist_entry_id];
        const name = path ? baseName(path) : 'a video';
        warnOnce(
          playlist,
          'bad:' + name,
          'ERROR: Skipping ' + name + ' in ' + playlist.name + ': ' +
            (e.file_error || 'mpv could not play it'),
        );
      }
    }

    let current = entries.findIndex((e) => e.current);
    if (current === -1 && entries.length > 0) {
      // Everything queued has played: start a fresh queue.
      await mpv.command('stop');
      entries = [];
    }
    // Drop the videos that have already played.
    for (let i = 0; i < current; i++) await mpv.command('playlist-remove', 0);
    if (current > 0) entries = entries.slice(current);

    const playing = entries.length ? entries[0].filename : null;
    const playingName = playing ? baseName(playing) : null;
    if (playingName && (!playlist.nowPlaying || playlist.nowPlaying.path !== playing)) {
      log(playlist.name + ': playing ' + playingName);
    }
    playlist.nowPlaying = playing ? { name: playingName, path: playing } : null;

    let queued = entries.length;
    if (queued >= QUEUE_AHEAD) return true;

    const videos = playlist.ordered ? pickedItems(playlist) : listVideos(playlist.folders, playlist.photos);
    if (playlist.ordered) {
      playlist.order = videos;
      if (videos.length === 0) {
        warnOnce(playlist, 'none', NO_PICKS);
        return queued > 0;
      }
      clearWarning(playlist, 'none');
    }
    if (playlist.photos && (videos === null || videos.length === 0)) {
      warnOnce(playlist, 'none', NO_UPLOADS);
      return queued > 0;
    }
    clearWarning(playlist, 'none');
    if (videos === null) {
      warnOnce(
        playlist,
        'missing',
        'No folder ' + playlist.folders[0] + ', so showing black. If it should ' +
          'have videos, add it to the repo\'s playlists/ and wait for the hourly sync.',
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
      let video;
      if (playlist.resumeAt) {
        const at = playlist.resumeAt;
        video = playlist.ordered
          ? videos.find((v) => v.path === at.path) || videos[0]
          : videos.find((v) => compareVideos(v, at) >= 0) || videos[0];
        playlist.resumeAt = null;
      } else if (playlist.ordered) {
        const last = playlist.lastQueued;
        const i = last ? videos.findIndex((v) => v.path === last.path) : -1;
        video = videos[(i + 1) % videos.length];
      } else {
        video = nextVideo(videos, playlist.lastQueued);
      }
      await mpv.command('loadfile', video.path, 'append-play');
      playlist.lastQueued = video;
      queued++;
    }
    return true;
  }

  // The playlist is leaving the screen: when it comes back, start again at
  // the video it was on.
  function setAside(playlist) {
    playlist.resumeAt = playlist.nowPlaying;
    playlist.lastQueued = null;
    playlist.nowPlaying = null;
    playlist.filesById = {};
  }

  function baseName(path) {
    return path.split('/').pop();
  }

  // The videos in `folders` (and photos too, with `withPhotos`), as
  // { name, path }, sorted by name. null if the first folder can't be read;
  // later folders are optional.
  function listVideos(folders, withPhotos) {
    const videos = [];
    for (let i = 0; i < folders.length; i++) {
      const names = listFolder(folders[i]);
      if (names === null) {
        if (i === 0) return null;
        continue;
      }
      names
        .filter((name) => isVideoFile(name, withPhotos))
        .forEach((name) => videos.push({ name, path: folders[i] + '/' + name }));
    }
    return videos.sort(compareVideos);
  }

  // ---------- My picks ----------

  // The saved picks, as paths relative to videoRoot, in order. A missing or
  // unreadable file is no picks.
  function readPicks() {
    const text = readText(PICKS_PATH);
    if (text === null) return [];
    try {
      const o = JSON.parse(text);
      return o && Array.isArray(o.picks) ? o.picks.filter((p) => typeof p === 'string') : [];
    } catch (e) {
      return [];
    }
  }

  // Whether `rel` can be picked: a video in a season folder or one of its
  // subfolders, or a photo or video in photos/, that is on the box now.
  function pickable(rel) {
    if (typeof rel !== 'string') return false;
    const parts = rel.split('/');
    if (parts.length < 2 || parts.length > 3) return false;
    if (parts.some((part) => part === '' || part.startsWith('.') || part.includes('\\'))) return false;
    if (parts[0] === PICKS) return false;
    const isUpload = parts[0] === PHOTOS;
    if (isUpload && parts.length !== 2) return false;
    const name = parts[parts.length - 1];
    if (!isVideoFile(name, isUpload)) return false;
    const names = listFolder(videoRoot + '/' + parts.slice(0, -1).join('/'));
    return names !== null && names.includes(name);
  }

  // Everything that can be picked, as { path, group }: the season folders and
  // their subfolders in name order, then the uploads.
  function pickableItems() {
    const items = [];
    const isFolder = (rel) => listFolder(videoRoot + '/' + rel) !== null;
    const visible = (n) => !n.startsWith('.');
    const label = (rel) => rel.split('/').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ');
    const add = (folder, group, withPhotos) => {
      const names = (listFolder(videoRoot + '/' + folder) || []).filter((n) => isVideoFile(n, withPhotos)).sort(compareNames);
      names.forEach((n) => items.push({ path: folder + '/' + n, group }));
    };
    const tops = (listFolder(videoRoot) || []).filter(visible).sort(compareNames);
    for (const top of tops) {
      if (top === PHOTOS || top === PICKS || !isFolder(top)) continue;
      add(top, label(top), false);
      const subs = (listFolder(videoRoot + '/' + top) || []).filter(visible).sort(compareNames);
      for (const sub of subs) {
        if (isFolder(top + '/' + sub)) add(top + '/' + sub, label(top + '/' + sub), false);
      }
    }
    add(PHOTOS, 'Uploads', true);
    return items;
  }

  // The picks playlist's items, as { name, path } with absolute paths,
  // skipping (and saying once) any that are no longer on the box.
  function pickedItems(playlist) {
    const items = [];
    for (const rel of readPicks()) {
      if (!pickable(rel)) {
        warnOnce(playlist, 'gone:' + rel, 'Skipping ' + rel + ' in picks: it is no longer on the box.');
        continue;
      }
      clearWarning(playlist, 'gone:' + rel);
      if (!items.some((v) => v.path === videoRoot + '/' + rel)) {
        items.push({ name: baseName(rel), path: videoRoot + '/' + rel });
      }
    }
    return items;
  }

  function isVideoFile(name, withPhotos) {
    if (name.startsWith('.') || !name.includes('.')) return false;
    const extension = name.split('.').pop().toLowerCase();
    return CONFIG.videoExtensions.includes(extension) ||
      (!!withPhotos && CONFIG.photoExtensions.includes(extension));
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

  // ---------- Logging ----------

  function warnOnce(playlist, key, message) {
    if (playlist.warnings[key]) return;
    playlist.warnings[key] = true;
    log(message);
  }

  function clearWarning(playlist, key) {
    delete playlist.warnings[key];
  }

  return {
    CONFIG, videoRoot, OVERRIDE_PATH, STATUS_PATH, QUEUE_AHEAD, PHOTOS, PICKS, PICKS_PATH,
    readPicks, pickable, pickableItems,
    validSchedule, validSeasons, describeSeason, activeSeason, resolve, parseDay,
    foldersFor, whatToShow, parseOverride, formatTime, createPlaylist, keepPlaying,
    setAside, listVideos, compareNames, isVideoFile,
  };
}

module.exports = { createScheduler };
