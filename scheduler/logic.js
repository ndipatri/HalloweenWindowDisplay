// The scheduler's logic: the items on the box and their tags, the box's
// filters and their schedules, overrides, and the queue in mpv.
// Used by player.js and website.js on the box, and by the tests with fakes.
'use strict';

// `io`: { config, videoRoot, readText(path) -> text or null,
//          writeText(path, text), removeFile(path),
//          listFolder(path) -> [names] or null, log(message),
//          mediaSize(path) -> { width, height } or null (only to play),
//          fileSize(path) -> bytes or null (optional) }
function createScheduler(io) {
  const CONFIG = io.config;
  const { readText, removeFile, listFolder, log } = io;
  const videoRoot = io.videoRoot;

  // Written by the website to override the schedule; checked every second.
  const OVERRIDE_PATH = videoRoot + '/override.json';
  // One line saying what's on screen and why; the website shows it.
  const STATUS_PATH = videoRoot + '/status';
  // The box's custom filters, in order, with their schedules (edited on the website).
  const FILTERS_PATH = videoRoot + '/filters.json';
  // The box's own tags on items, by path: { "tags": { "photos/00001-a.jpg": ["favorites"] } }.
  const TAGS_PATH = videoRoot + '/tags.json';
  // The GitHub filters, copied by sync from the repo's playlists/filters.json.
  const GITHUB_FILTERS_PATH = videoRoot + '/github-filters.json';
  // Which way the TV faces, set on the website: { "orientation": "landscape" }.
  const SCREEN_PATH = videoRoot + '/screen.json';
  const ORIENTATIONS = ['portrait', 'landscape'];

  // Videos queued ahead of time, so one follows the next without a gap.
  const QUEUE_AHEAD = 3;

  // The uploads from the website live here, and are all tagged `upload`.
  const PHOTOS = 'photos';
  const UPLOAD_TAG = 'upload';

  const once = {}; // messages logged once, by key (cleared when they stop applying)
  function logOnce(key, message) {
    if (once[key] === message) return;
    once[key] = message;
    log(message);
  }
  function forget(key) { delete once[key]; }

  // ---------- Items and tags ----------

  // A tag: 1 to 30 lowercase letters, digits and dashes, not starting or
  // ending with a dash.
  function isTagName(value) {
    return typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(value);
  }

  // 'halloween/kid' -> 'halloween-kid', 'Easter Eggs' -> 'easter-eggs'.
  function tagFromFolder(rel) {
    return rel.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  // 'halloween/kid' -> 'Halloween / Kid'.
  function groupLabel(rel) {
    return rel.split('/').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ');
  }

  // The box's own tags: { path: [tags] }. A missing file is none; a bad one
  // is none, logged once.
  function readBoxTags() {
    const text = readText(TAGS_PATH);
    if (text === null) return {};
    try {
      const o = JSON.parse(text);
      if (!o || typeof o.tags !== 'object' || o.tags === null || Array.isArray(o.tags)) throw new Error('no "tags"');
      forget('tags');
      // Only lists of tag names count; anything else in a hand-edited file is skipped.
      const out = {};
      for (const [p, list] of Object.entries(o.tags)) {
        if (Array.isArray(list)) out[p] = list.filter((t) => typeof t === 'string');
      }
      return out;
    } catch (e) {
      logOnce('tags', 'ERROR: Ignoring ' + TAGS_PATH + ': ' + e.message + '.');
      return {};
    }
  }

  // Every item on the box: { path (relative), file (absolute), name,
  // folderTags, boxTags, group, kind }. Videos in each top folder (other
  // than photos) and its subfolders, folders in name order and files in name
  // order within them, then the uploads in upload order.
  function items() {
    const boxTags = readBoxTags();
    const out = [];
    const visible = (n) => !n.startsWith('.');
    const isFolder = (rel) => listFolder(videoRoot + '/' + rel) !== null;
    const add = (folder, tag, group, withPhotos) => {
      const names = (listFolder(videoRoot + '/' + folder) || [])
        .filter((n) => isVideoFile(n, withPhotos)).sort(compareNames);
      for (const name of names) {
        const rel = folder + '/' + name;
        // Only uploads have box tags: a video from GitHub has just its folder's tag.
        const own = withPhotos && Array.isArray(boxTags[rel]) ? boxTags[rel] : [];
        const extra = [];
        for (const t of own) if (isTagName(t) && t !== tag && t !== UPLOAD_TAG && !extra.includes(t)) extra.push(t);
        out.push({
          path: rel, file: videoRoot + '/' + rel, name, folderTags: [tag], boxTags: extra, group,
          kind: CONFIG.photoExtensions.includes(name.split('.').pop().toLowerCase()) ? 'photo' : 'video',
        });
      }
    };
    const folder = (rel) => {
      const tag = tagFromFolder(rel);
      if (!isTagName(tag)) {
        logOnce('folder:' + rel, 'Leaving out ' + rel + ": its name doesn't make a tag (at most 30 letters, digits and dashes).");
        return;
      }
      add(rel, tag, groupLabel(rel), false);
    };
    const tops = (listFolder(videoRoot) || []).filter(visible).sort(compareNames);
    for (const top of tops) {
      if (top === PHOTOS || !isFolder(top)) continue;
      folder(top);
      const subs = (listFolder(videoRoot + '/' + top) || []).filter(visible).sort(compareNames);
      for (const sub of subs) if (isFolder(top + '/' + sub)) folder(top + '/' + sub);
    }
    add(PHOTOS, UPLOAD_TAG, 'Uploads', true);
    return out;
  }

  // Every tag on some item, in name order.
  function tagsInUse(list) {
    const all = new Set();
    for (const i of list) i.folderTags.concat(i.boxTags).forEach((t) => all.add(t));
    return Array.from(all).sort(compareNames);
  }

  // ---------- Filters ----------

  const FILTER_NAME = /^[A-Za-z0-9' -]{1,30}$/;

  function isFilterName(value) {
    return typeof value === 'string' && FILTER_NAME.test(value) && value.trim() === value &&
      !['black', 'off'].includes(value.toLowerCase());
  }

  // What is wrong with one filter (raw, as in filters.json), or null.
  function filterError(f) {
    if (!f || typeof f !== 'object') return 'it is not a filter';
    if (typeof f.name !== 'string' || !FILTER_NAME.test(f.name.trim()) || f.name.trim() !== f.name) {
      return "a name is 1 to 30 letters, digits, spaces, - or '";
    }
    if (['black', 'off'].includes(f.name.toLowerCase())) return f.name + ' is kept for the Black button';
    if (!Array.isArray(f.anyOf) || f.anyOf.length === 0) return 'it has no "any of" tags';
    for (const list of [f.anyOf, f.except || []]) {
      if (!Array.isArray(list)) return '"except" should be a list of tags';
      const bad = list.find((t) => !isTagName(t));
      if (bad !== undefined) return 'not a tag name: ' + JSON.stringify(bad);
    }
    if (f.schedule !== undefined && !Array.isArray(f.schedule)) return 'its schedule should be a list';
    if (!f.schedule || f.schedule.length === 0) {
      return 'a filter needs days and times; to play tags any time, pick them under Play';
    }
    for (const [i, e] of (f.schedule || []).entries()) {
      const error = entryError(e);
      if (error) return 'schedule entry ' + (i + 1) + ': ' + error;
    }
    return null;
  }

  function entryError(e) {
    if (!e || typeof e !== 'object') return 'not an entry';
    const hasFrom = e.from !== undefined && e.from !== '';
    const hasTo = e.to !== undefined && e.to !== '';
    if (hasFrom !== hasTo) return 'it needs both a first and a last day, or neither';
    if (hasFrom && !parseDay(e.from, false)) return 'bad first day ' + JSON.stringify(e.from);
    if (hasTo && !parseDay(e.to, false)) return 'bad last day ' + JSON.stringify(e.to);
    if (e.weekdays !== undefined && e.weekdays.length !== 0 && parseWeekdays(e.weekdays) === null) return 'bad weekdays';
    if (e.also !== undefined) {
      if (!Array.isArray(e.also)) return 'extra days should be a list';
      const bad = e.also.find((d) => !parseDay(d, true));
      if (bad !== undefined) return 'bad extra day ' + JSON.stringify(bad);
    }
    if (!hasFrom && !(e.also || []).length) return 'it has no days';
    if (e.times !== undefined) {
      if (!Array.isArray(e.times)) return 'times should be a list';
      for (const w of e.times) {
        if (!w || !isTime(w.start) || !isTime(w.stop)) return 'bad time ' + JSON.stringify(w);
        if (w.start === w.stop) return 'a time needs a stop different from its start';
      }
    }
    return null;
  }

  // Checks a list of raw filters. { filters: the usable ones, compiled, in
  // order; errors: [{ index, name, error }] }. Names must differ, ignoring case.
  function checkFilters(list) {
    const out = { filters: [], errors: [] };
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((f, index) => {
      let error = filterError(f);
      if (!error && seen.has(f.name.toLowerCase())) error = 'two filters are called ' + f.name;
      if (error) {
        out.errors.push({ index, name: f && typeof f.name === 'string' && f.name.trim() ? f.name : null, error });
        return;
      }
      seen.add(f.name.toLowerCase());
      out.filters.push(compileFilter(f));
    });
    return out;
  }

  function compileFilter(f) {
    return {
      name: f.name,
      anyOf: f.anyOf.slice(),
      except: (f.except || []).slice(),
      entries: (f.schedule || []).map((e) => ({
        fromDay: e.from ? parseDay(e.from, false) : null,
        toDay: e.to ? parseDay(e.to, false) : null,
        // Whether the range runs across the new year, from the months as
        // written, so a day that moves with the year (11-4thu) can't flip it.
        wraps: !!e.from && Number(e.from.slice(0, 2)) > Number(e.to.slice(0, 2)),
        weekdays: e.weekdays && e.weekdays.length ? parseWeekdays(e.weekdays) : null,
        alsoDays: (e.also || []).map((d) => parseDay(d, true)),
        times: e.times && e.times.length
          ? e.times.map((w) => ({ start: toMinutes(w.start), stop: toMinutes(w.stop) }))
          : [{ start: 0, stop: 24 * 60 }],
      })),
    };
  }

  // The box's filters: its custom ones (filters.json, edited on the website,
  // in the person's order), then the GitHub ones (github-filters.json, copied
  // from the repo's playlists/filters.json by sync, in that file's order).
  // A custom filter with a GitHub filter's name is left out. Reread when
  // either file changes; what's wrong is logged once per version of them.
  let filtersCache = { key: undefined, filters: [], clean: true };
  function readFilters() {
    const customText = readText(FILTERS_PATH);
    const githubText = readText(GITHUB_FILTERS_PATH);
    const key = JSON.stringify([customText, githubText]);
    if (key === filtersCache.key) return filtersCache.filters;
    let clean = true;
    // One file's usable filters (what's wrong is logged, and makes it not clean).
    const parse = (text, path, label) => {
      if (text === null) return [];
      let raw;
      try { raw = JSON.parse(text); } catch (e) { raw = null; }
      if (!raw || !Array.isArray(raw.filters)) {
        log('ERROR: Ignoring ' + path + ': not a list of filters.');
        clean = false;
        return [];
      }
      const checked = checkFilters(raw.filters);
      for (const e of checked.errors) {
        log('ERROR: Ignoring ' + label + ' ' + (e.index + 1) + (e.name ? ' (' + e.name + ')' : '') + ': ' + e.error + '.');
      }
      if (checked.errors.length) clean = false;
      return checked.filters;
    };
    const github = parse(githubText, GITHUB_FILTERS_PATH, 'GitHub filter').map((f) => Object.assign(f, { source: 'github' }));
    const githubNames = new Map(github.map((f) => [f.name.toLowerCase(), f.name]));
    const custom = [];
    parse(customText, FILTERS_PATH, 'filter').forEach((f) => {
      f.source = 'custom';
      const clash = githubNames.get(f.name.toLowerCase());
      if (clash) {
        const index = rawIndex(customText, f.name);
        log('ERROR: Ignoring filter ' + index + ' (' + f.name + '): GitHub has a filter called ' + clash + '.');
        clean = false;
        return;
      }
      custom.push(f);
    });
    const filters = custom.concat(github);
    if (customText === null && githubText === null) {
      log('No filters on this box yet, so nothing is scheduled. Add one on the website.');
    }
    filtersCache = { key, filters, clean };
    return filters;
  }

  // The position (1-based) of the filter called `name` in a filters file.
  function rawIndex(text, name) {
    try {
      return JSON.parse(text).filters.findIndex((f) => f && f.name === name) + 1;
    } catch (e) {
      return 0;
    }
  }

  // The raw filters as saved (for the website): { custom, github }.
  function readRawFilters() {
    const raw = (path) => {
      try {
        const o = JSON.parse(readText(path));
        return o && Array.isArray(o.filters) ? o.filters : [];
      } catch (e) {
        return [];
      }
    };
    return { custom: raw(FILTERS_PATH), github: raw(GITHUB_FILTERS_PATH) };
  }

  function findFilter(filters, name) {
    return filters.find((f) => f.name === name) || null;
  }

  // The filter's items, in play order: name order (numbers as numbers),
  // then path.
  function filterItems(filter, list) {
    return (list || items())
      .filter((i) => {
        const tags = i.folderTags.concat(i.boxTags);
        return filter.anyOf.some((t) => tags.includes(t)) && !filter.except.some((t) => tags.includes(t));
      })
      .sort((a, b) => compareNames(a.name, b.name) || compareNames(a.path, b.path));
  }

  // ---------- Schedule ----------

  function isTime(value) {
    return typeof value === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function toMinutes(hhmm) {
    const [hours, minutes] = hhmm.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // The first filter, in list order, with an entry covering `date`, or null.
  function scheduledFilter(filters, date) {
    return filters.find((f) => f.entries.some((e) => entryCovers(e, date))) || null;
  }

  function entryCovers(entry, date) {
    const now = date.getHours() * 60 + date.getMinutes();
    for (const w of entry.times) {
      let day = null;
      if (w.start < w.stop) {
        if (now >= w.start && now < w.stop) day = date;
      } else if (now >= w.start) {
        day = date; // crosses midnight: the part before midnight
      } else if (now < w.stop) {
        day = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12); // the part after
      }
      if (day && dayCovered(entry, day)) return true;
    }
    return false;
  }

  // Whether an entry's days include `date`: an extra day whatever its
  // weekday, or a day in its range (inclusive; a range whose last day is
  // before its first wraps the new year) that is one of its weekdays.
  function dayCovered(e, date) {
    const year = date.getFullYear();
    const today = (date.getMonth() + 1) * 100 + date.getDate();
    const sameDay = (d) => d && d.year === year && d.month * 100 + d.day === today;
    // An extra day with an offset can land in the year before or after the
    // one it is written for ('01-01-1' is Dec 31 of the year before).
    if (e.alsoDays.some((f) => sameDay(f(year)) || sameDay(f(year + 1)) || sameDay(f(year - 1)))) return true;
    if (!e.fromDay || !e.toDay) return false; // only extra days
    if (e.weekdays && !e.weekdays.includes(date.getDay())) return false;
    // from and to as month-day numbers in this year (a nth-weekday day
    // moves from year to year). A day with an offset that lands in another
    // year (e.g. '01-01-1') is taken by its month and day.
    const from = e.fromDay(year);
    const to = e.toDay(year);
    if (!from || !to) return false; // e.g. 02-29 in a year without one
    const f = from.month * 100 + from.day;
    const t = to.month * 100 + to.day;
    return e.wraps ? today >= f || today <= t : today >= f && today <= t;
  }

  function scheduledName(filters, date) {
    const f = scheduledFilter(filters, date);
    return f ? f.name : null;
  }

  // When what the schedule plays next differs from what it plays at `from`,
  // to the minute, looking `days` ahead (1 for the status line; a year for
  // an override that lasts until the schedule changes). null if it doesn't
  // change in that time. What is scheduled can only change at midnight or
  // where some window starts or stops, so only those minutes are checked.
  function nextScheduleChange(filters, from, days = 1) {
    const current = scheduledName(filters, from);
    const marks = new Set([0]);
    for (const f of filters) for (const e of f.entries) for (const w of e.times) { marks.add(w.start % 1440); marks.add(w.stop % 1440); }
    const minutes = Array.from(marks).sort((a, b) => a - b);
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = from.getTime() + days * 24 * 60 * 60 * 1000;
    for (let d = 0; d <= days; d++) {
      for (const m of minutes) {
        const t = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d, 0, m);
        if (t.getTime() <= from.getTime()) continue;
        if (t.getTime() > end) return null;
        if (scheduledName(filters, t) !== current) return t;
      }
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

  function isMonthDay(value) {
    if (typeof value !== 'string' || !/^\d\d-\d\d$/.test(value)) return false;
    const [month, day] = value.split('-').map(Number);
    const daysIn = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return month >= 1 && month <= 12 && day >= 1 && day <= daysIn[month - 1];
  }


  // ---------- What to show: override or schedule ----------

  // Returns { filter, status }: the filter's name to play (null for black)
  // and a one-line description of what's showing and why.
  function whatToShow(filters, now, overrideState) {
    const override = currentOverride(filters, now, overrideState);
    if (override) {
      return {
        filter: override.filter,
        status: (override.filter === null ? 'black' : override.filter) + ' (override ' + override.until + ')',
      };
    }
    const name = scheduledName(filters, now);
    const change = nextScheduleChange(filters, now);
    if (!name) {
      return { filter: null, status: 'black (nothing scheduled' + (change ? ' until ' + formatTime(change, now) : '') + ')' };
    }
    return { filter: name, status: name + ' (scheduled ' + (change ? 'until ' + formatTime(change, now) : 'all day') + ')' };
  }

  // Reads the override file. Ends an override whose time is up, whose
  // filter is gone, or from before filters, by deleting the file. Returns
  // { filter, until } while one is in force, else null.
  function currentOverride(filters, now, state) {
    const text = readText(OVERRIDE_PATH);
    if (text === null) return null;
    const end = (message) => {
      // Only delete it if the website hasn't just replaced it with a new one.
      if (readText(OVERRIDE_PATH) === text) removeFile(OVERRIDE_PATH);
      log(message);
      return null;
    };

    const parsed = parseOverride(text);
    if (!parsed.ok) {
      if (parsed.old) return end('Ending an override from before tags could be played (' + parsed.old + ').');
      if (state.warnedText !== text) {
        state.warnedText = text;
        log('ERROR: Ignoring ' + OVERRIDE_PATH + ': ' + parsed.error);
      }
      return null;
    }
    const o = parsed.value;
    // A filter missing from a file with mistakes in it may come back when
    // they are fixed, so its override is only ended when the files are clean.
    const gone = o.tags === null ? undefined : o.filters.find((name) => !findFilter(filters, name));
    if (gone !== undefined && filtersCache.clean) {
      return end('Ending the override: there is no filter called ' + gone + ' any more.');
    }
    const name = o.tags === null ? null : pickName(o.tags, o.filters);

    const decision = decideOverride(o, filters, now);
    if (!decision.active) {
      return end('Override of ' + (name === null ? 'black' : name) + ' ended: ' + decision.reason + '.');
    }
    return {
      filter: name,
      until: decision.endsAt
        ? (decision.atScheduleChange ? 'until the schedule changes at ' : 'until ') + formatTime(decision.endsAt, now)
        : 'until cleared',
    };
  }

  // Override file, as written by the website:
  //   { "tags": ["favorites"] | null, "filters": ["Halloween kid"], "setAt": <ms>,
  //     "expires": <ms> | null, "untilCleared": true | false }
  // tags null means black. Otherwise it plays everything with any of the tags,
  // plus everything each filter picks. With no `expires` and untilCleared
  // false, it lasts until the schedule next changes after `setAt`. A file
  // from before tags could be played ({ "filter": ... } or { "playlist": ... })
  // is { ok: false, old: <what it named> }.
  function parseOverride(text) {
    let o;
    try {
      o = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'not valid JSON' };
    }
    if (o === null || typeof o !== 'object') return { ok: false, error: 'not an object' };
    if (!('tags' in o) && ('filter' in o || 'playlist' in o)) {
      const old = 'filter' in o ? o.filter : o.playlist;
      return { ok: false, old: old === null ? 'black' : String(old), error: 'from before tags could be played' };
    }
    let tags = null;
    let filters = [];
    if (o.tags !== null) {
      if (!Array.isArray(o.tags) || !o.tags.every(isTagName)) return { ok: false, error: 'bad "tags"' };
      if (o.filters !== undefined && (!Array.isArray(o.filters) || !o.filters.every(isFilterName))) {
        return { ok: false, error: 'bad "filters"' };
      }
      tags = o.tags;
      filters = o.filters || [];
      if (tags.length + filters.length === 0) return { ok: false, error: 'no tags or filters' };
    }
    if (typeof o.setAt !== 'number') return { ok: false, error: 'bad "setAt"' };
    if (o.expires !== null && o.expires !== undefined && typeof o.expires !== 'number') {
      return { ok: false, error: 'bad "expires"' };
    }
    return {
      ok: true,
      value: {
        tags,
        filters,
        setAt: o.setAt,
        expires: typeof o.expires === 'number' ? o.expires : null,
        untilCleared: o.untilCleared === true,
      },
    };
  }

  // What a pick of tags and filters is called on screen and in the log:
  // '#favorites + Halloween kid'. Also the key of its playlist.
  function pickName(tags, filters) {
    return tags.map((t) => '#' + t).concat(filters).join(' + ');
  }

  // { active: true, endsAt: Date | null, atScheduleChange } or
  // { active: false, reason }.
  function decideOverride(o, filters, now) {
    if (o.untilCleared) return { active: true, endsAt: null, atScheduleChange: false };
    if (o.expires !== null) {
      return now.getTime() >= o.expires
        ? { active: false, reason: 'time is up' }
        : { active: true, endsAt: new Date(o.expires), atScheduleChange: false };
    }
    const change = nextScheduleChange(filters, new Date(o.setAt), 366);
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


  // ---------- Playing a filter ----------

  // Which way the TV faces: 'portrait' (also when nothing is saved, or what
  // is saved can't be read) or 'landscape'.
  function readScreen() {
    const text = readText(SCREEN_PATH);
    if (text === null) return 'portrait';
    try {
      const o = JSON.parse(text).orientation;
      if (ORIENTATIONS.includes(o)) return o;
    } catch (e) { /* below */ }
    logOnce('screen', "WARNING: Couldn't read " + SCREEN_PATH + ': taking the TV as portrait.');
    return 'portrait';
  }

  // How far mpv turns the picture for the way the TV faces.
  function rotationFor(orientation) {
    return orientation === 'landscape' ? CONFIG.box.landscapeRotate : CONFIG.box.rotate;
  }

  // Items' shapes as shown, measured once each: by path and size, since sync
  // can replace a video under the same name.
  const shapes = new Map();
  // 'portrait', 'landscape', 'square', or null for an item that can't be measured.
  function shapeOf(path) {
    const key = path + ':' + (io.fileSize ? io.fileSize(path) : '');
    if (!shapes.has(key)) {
      const size = io.mediaSize ? io.mediaSize(path) : null;
      shapes.set(key, !size ? null : size.width === size.height ? 'square' : size.width > size.height ? 'landscape' : 'portrait');
    }
    return shapes.get(key);
  }

  // An item's shape for choosing what plays: the tag `portrait` or
  // `landscape` when it has exactly one of them (set on the website, to
  // override what's measured), otherwise its measured shape.
  function itemShape(path, tags) {
    const said = ORIENTATIONS.filter((o) => (tags || []).includes(o));
    return said.length === 1 ? said[0] : shapeOf(path);
  }

  // Whether an item plays on a TV facing that way: when it's the TV's
  // shape, or square. One that can't be measured (and has no shape tag)
  // never plays.
  function suitsScreen(path, orientation, tags) {
    const shape = itemShape(path, tags);
    return shape === 'square' || shape === orientation;
  }

  // Whether a photo fills a screen facing that way: only when it's the
  // same shape (portrait or landscape) as the screen. A square photo, or
  // one that can't be measured, is shown whole.
  function photoFills(path, orientation) {
    return shapeOf(path) === orientation;
  }

  // The queue state for one filter, by name.
  function createPlaylist(name) {
    return {
      name,
      lastQueued: null, // the last item put in mpv's queue, as { name, path }
      resumeAt: null, // when the filter comes back: the item to start at
      nowPlaying: null, // the playing item, as { name, path }
      filesById: {}, // mpv playlist entry id -> path, to name failed items
      held: null, // mpv playlist entry id of a lone photo held on screen
      warnings: {},
    };
  }

  // What a playlist plays, from its name: a filter's name (on its schedule),
  // or a pick from the Play section ('#favorites + Halloween kid': tags with
  // '#', and filters). { known, items: [{ name, path (absolute) }], none }:
  // known is false when it names nothing playable (a filter that's gone);
  // none is what to say when nothing has those tags yet.
  function playlistItems(playlist) {
    const filters = readFilters();
    const parts = playlist.name.split(' + ');
    const tags = parts.filter((p) => p.startsWith('#')).map((p) => p.slice(1));
    const names = parts.filter((p) => !p.startsWith('#'));
    const picked = names.map((n) => findFilter(filters, n)).filter(Boolean);
    if (!tags.length && !picked.length) return { known: false, items: [], none: '' };
    const all = items();
    const chosen = new Set();
    for (const i of all) {
      const has = i.folderTags.concat(i.boxTags);
      if (tags.some((t) => has.includes(t))) chosen.add(i);
    }
    for (const f of picked) filterItems(f, all).forEach((i) => chosen.add(i));
    let list = Array.from(chosen)
      .sort((a, b) => compareNames(a.name, b.name) || compareNames(a.path, b.path))
      .map((i) => ({ name: i.name, path: i.file, tags: i.folderTags.concat(i.boxTags) }));
    // Only the items the TV's shape play; with none, nothing (black).
    const orientation = readScreen();
    for (const i of list) {
      if (itemShape(i.path, i.tags) === null) {
        warnOnce(playlist, 'unmeasured:' + i.path, 'WARNING: Leaving out ' + i.name + ' in ' + playlist.name +
          ": it can't be measured. Tag it portrait or landscape to play it.");
      }
    }
    const suiting = list.filter((i) => suitsScreen(i.path, orientation, i.tags));
    if (list.length && !suiting.length) {
      return { known: true, items: [], none: 'Nothing in ' + playlist.name + ' is ' + orientation +
        '. Showing black until something is, or the TV is turned back.' };
    }
    list = suiting;
    let none;
    if (!names.length) none = 'Nothing tagged ' + tags.join(', ') + ' yet. Showing black until something is.';
    else if (!tags.length && names.length === 1 && picked.length === 1) {
      none = 'Nothing in ' + picked[0].name + ' yet (any of ' + picked[0].anyOf.join(', ') + '). Showing black until something is tagged.';
    } else none = 'Nothing in ' + playlist.name + ' yet. Showing black until something is tagged.';
    return { known: true, items: list, none };
  }

  // Keeps mpv's queue topped up with the filter's items, in name order,
  // round and round. Re-reads the items each time, so added or removed ones
  // are picked up without a restart. Returns whether there is anything to
  // show. `mpv` is the box's mpv (or the tests' fake):
  // command(...args), getProperty(name), takeEvents().
  async function keepPlaying(playlist, mpv) {
    // An item mpv failed on stays in its playlist (behind the current one)
    // until removed below, so read the playlist first: then every failure
    // can be named.
    let entries = (await mpv.getProperty('playlist')) || [];
    entries.forEach((e) => { playlist.filesById[e.id] = e.filename; });
    for (const e of mpv.takeEvents()) {
      if (e.event === 'end-file' && e.reason === 'error') {
        const path = playlist.filesById[e.playlist_entry_id];
        const name = path ? baseName(path) : 'an item';
        warnOnce(playlist, 'bad:' + name,
          'ERROR: Skipping ' + name + ' in ' + playlist.name + ': ' + (e.file_error || 'mpv could not play it'));
      }
    }

    const current = entries.findIndex((e) => e.current);
    if (current === -1 && entries.length > 0) {
      // Everything queued has played: start a fresh queue.
      await mpv.command('stop');
      entries = [];
    }
    // Drop the items that have already played.
    for (let i = 0; i < current; i++) await mpv.command('playlist-remove', 0);
    if (current > 0) entries = entries.slice(current);

    const playing = entries.length ? entries[0].filename : null;
    const playingName = playing ? baseName(playing) : null;
    if (playingName && (!playlist.nowPlaying || playlist.nowPlaying.path !== playing)) {
      log(playlist.name + ': playing ' + playingName);
    }
    playlist.nowPlaying = playing ? { name: playingName, path: playing } : null;

    // A lone photo is held on screen (queued once, see below) for as long as
    // it is the only thing to play. Once something else is to play, it goes:
    // straight away if it's waiting behind, or once what comes next is queued
    // if it's on screen, so mpv moves straight on rather than going black.
    let releaseHeld = false;
    if (playlist.held !== null) {
      const at = entries.findIndex((e) => e.id === playlist.held);
      if (at === -1) playlist.held = null;
      else {
        const now = playlistItems(playlist).items;
        if (now.length === 1 && now[0].path === entries[at].filename) return true;
        playlist.held = null;
        if (at === 0) releaseHeld = true;
        else {
          await mpv.command('playlist-remove', at);
          entries.splice(at, 1);
        }
      }
    }
    const done = async (result) => {
      // Removing the entry on screen makes mpv play the next one (or stop).
      if (releaseHeld) await mpv.command('playlist-remove', 0);
      return result;
    };

    let queued = entries.length - (releaseHeld ? 1 : 0); // not counting a photo on its way out
    if (queued >= QUEUE_AHEAD) return done(true);

    const { known, items: videos, none } = playlistItems(playlist);
    if (!known) return done(queued > 0);
    if (videos.length === 0) {
      warnOnce(playlist, 'none', none);
      return done(queued > 0);
    }
    clearWarning(playlist, 'none');

    const orientation = readScreen();
    while (queued < QUEUE_AHEAD) {
      let video;
      if (playlist.resumeAt) {
        const at = playlist.resumeAt;
        video = videos.find((v) => compareVideos(v, at) >= 0) || videos[0];
        playlist.resumeAt = null;
      } else {
        video = nextVideo(videos, playlist.lastQueued);
      }
      // A photo the screen's shape fills it, its edges cropped; any other
      // photo, and every video, is fitted whole, with black around it. Each
      // item says which for itself (see mpv.js for why).
      const fill = isPhotoFile(video.path) && photoFills(video.path, orientation);
      const panscan = fill ? 'panscan=1.0' : 'panscan=0';
      if (videos.length === 1 && isPhotoFile(video.path)) {
        // The only thing to play is one photo: queue it once and hold it on
        // screen, instead of reloading it every few seconds (which flashes
        // black each time). It goes when something else is to play (above).
        await mpv.command('loadfile', video.path, 'append-play', -1, panscan + ',image-display-duration=inf');
        const after = (await mpv.getProperty('playlist')) || [];
        playlist.held = after.length ? after[after.length - 1].id : null;
        playlist.lastQueued = video;
        break;
      }
      await mpv.command('loadfile', video.path, 'append-play', -1, panscan);
      playlist.lastQueued = video;
      queued++;
    }
    return done(true);
  }

  // The filter is leaving the screen: when it comes back, start again at the
  // item it was on.
  function setAside(playlist) {
    playlist.resumeAt = playlist.nowPlaying;
    playlist.lastQueued = null;
    playlist.nowPlaying = null;
    playlist.filesById = {};
    playlist.held = null;
  }

  function baseName(path) {
    return path.split('/').pop();
  }

  function isVideoFile(name, withPhotos) {
    if (name.startsWith('.') || !name.includes('.')) return false;
    const extension = name.split('.').pop().toLowerCase();
    return CONFIG.videoExtensions.includes(extension) ||
      (!!withPhotos && CONFIG.photoExtensions.includes(extension));
  }

  function isPhotoFile(path) {
    return CONFIG.photoExtensions.includes(path.split('.').pop().toLowerCase());
  }

  // Name order, with numbers compared as numbers: 2-ghost.mp4 before 10-hand.mp4.
  function compareNames(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  // By file name, then by path, so the same name in two folders has a fixed order.
  function compareVideos(a, b) {
    return compareNames(a.name, b.name) || compareNames(a.path, b.path);
  }

  // The item after `last` in name order, wrapping round to the first.
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
    CONFIG, videoRoot, OVERRIDE_PATH, STATUS_PATH, FILTERS_PATH, GITHUB_FILTERS_PATH, TAGS_PATH, SCREEN_PATH, ORIENTATIONS, QUEUE_AHEAD, PHOTOS, UPLOAD_TAG,
    readScreen, rotationFor, photoFills, suitsScreen, shapeOf, itemShape, isPhotoFile,
    isTagName, tagFromFolder, readBoxTags, items, tagsInUse,
    isFilterName, checkFilters, readFilters, readRawFilters, findFilter, filterItems,
    scheduledFilter, nextScheduleChange, whatToShow, parseOverride, pickName, parseDay, parseWeekdays, formatTime,
    createPlaylist, playlistItems, keepPlaying, setAside, compareNames, compareVideos, isVideoFile,
  };
}

module.exports = { createScheduler };
