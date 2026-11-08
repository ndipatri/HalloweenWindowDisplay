// The scheduler's logic: the items on the box and their tags, the box's
// filters and their schedules, overrides, and the queue in mpv.
// Used by player.js and website.js on the box, and by the tests with fakes.
'use strict';

// `io`: { config, videoRoot, readText(path) -> text or null,
//          writeText(path, text), removeFile(path),
//          listFolder(path) -> [names] or null, log(message) }
function createScheduler(io) {
  const CONFIG = io.config;
  const { readText, removeFile, listFolder, log } = io;
  const videoRoot = io.videoRoot;

  // Written by the website to override the schedule; checked every second.
  const OVERRIDE_PATH = videoRoot + '/override.json';
  // One line saying what's on screen and why; the website shows it.
  const STATUS_PATH = videoRoot + '/status';
  // The box's filters, in order, with their schedules (edited on the website).
  const FILTERS_PATH = videoRoot + '/filters.json';
  // The box's own tags on items, by path: { "tags": { "halloween/x.mp4": ["favorites"] } }.
  const TAGS_PATH = videoRoot + '/tags.json';

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
        const own = Array.isArray(boxTags[rel]) ? boxTags[rel] : [];
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

  // The box's filters, from filters.json, reread when the file changes.
  // Bad filters are skipped and logged once per version of the file.
  let filtersCache = { text: undefined, filters: [], clean: true };
  function readFilters() {
    const text = readText(FILTERS_PATH);
    if (text === filtersCache.text) return filtersCache.filters;
    let filters = [];
    let clean = true;
    if (text === null) {
      log('No filters on this box yet, so nothing is scheduled. Add one on the website.');
    } else {
      let raw;
      try {
        raw = JSON.parse(text);
      } catch (e) {
        raw = null;
      }
      if (!raw || !Array.isArray(raw.filters)) {
        log('ERROR: Ignoring ' + FILTERS_PATH + ': not a list of filters, so nothing is scheduled.');
        clean = false;
      } else {
        const checked = checkFilters(raw.filters);
        for (const e of checked.errors) {
          log('ERROR: Ignoring filter ' + (e.index + 1) + (e.name ? ' (' + e.name + ')' : '') + ': ' + e.error + '.');
        }
        filters = checked.filters;
        clean = checked.errors.length === 0;
      }
    }
    filtersCache = { text, filters, clean };
    return filters;
  }

  // The raw filters as saved (for the website), or [].
  function readRawFilters() {
    try {
      const o = JSON.parse(readText(FILTERS_PATH));
      return o && Array.isArray(o.filters) ? o.filters : [];
    } catch (e) {
      return [];
    }
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
      if (parsed.old) return end('Ending an override from before filters (' + parsed.old + ').');
      if (state.warnedText !== text) {
        state.warnedText = text;
        log('ERROR: Ignoring ' + OVERRIDE_PATH + ': ' + parsed.error);
      }
      return null;
    }
    const o = parsed.value;
    // A filter missing from a file with mistakes in it may come back when
    // they are fixed, so its override is only ended when the file is clean.
    if (o.filter !== null && !findFilter(filters, o.filter) && filtersCache.clean) {
      return end('Ending the override: there is no filter called ' + o.filter + ' any more.');
    }

    const decision = decideOverride(o, filters, now);
    if (!decision.active) {
      return end('Override of ' + (o.filter === null ? 'black' : o.filter) + ' ended: ' + decision.reason + '.');
    }
    return {
      filter: o.filter,
      until: decision.endsAt
        ? (decision.atScheduleChange ? 'until the schedule changes at ' : 'until ') + formatTime(decision.endsAt, now)
        : 'until cleared',
    };
  }

  // Override file, as written by the website:
  //   { "filter": "Halloween kid" | null, "setAt": <ms>,
  //     "expires": <ms> | null, "untilCleared": true | false }
  // filter null means black. With no `expires` and untilCleared false, the
  // override lasts until the schedule next changes after `setAt`. A file from
  // before filters ({ "playlist": ... }) is { ok: false, old: <playlist> }.
  function parseOverride(text) {
    let o;
    try {
      o = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'not valid JSON' };
    }
    if (o === null || typeof o !== 'object') return { ok: false, error: 'not an object' };
    if (!('filter' in o) && 'playlist' in o) {
      return { ok: false, old: o.playlist === null ? 'black' : String(o.playlist), error: 'from before filters' };
    }
    if (!(o.filter === null || isFilterName(o.filter))) return { ok: false, error: 'bad "filter"' };
    if (typeof o.setAt !== 'number') return { ok: false, error: 'bad "setAt"' };
    if (o.expires !== null && o.expires !== undefined && typeof o.expires !== 'number') {
      return { ok: false, error: 'bad "expires"' };
    }
    return {
      ok: true,
      value: {
        filter: o.filter,
        setAt: o.setAt,
        expires: typeof o.expires === 'number' ? o.expires : null,
        untilCleared: o.untilCleared === true,
      },
    };
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

  // The queue state for one filter, by name.
  function createPlaylist(name) {
    return {
      name,
      lastQueued: null, // the last item put in mpv's queue, as { name, path }
      resumeAt: null, // when the filter comes back: the item to start at
      nowPlaying: null, // the playing item, as { name, path }
      filesById: {}, // mpv playlist entry id -> path, to name failed items
      warnings: {},
    };
  }

  // The filter's items as mpv plays them: { name, path (absolute) }.
  function playlistItems(playlist) {
    const filter = findFilter(readFilters(), playlist.name);
    if (!filter) return { filter: null, items: [] };
    return { filter, items: filterItems(filter).map((i) => ({ name: i.name, path: i.file })) };
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

    let queued = entries.length;
    if (queued >= QUEUE_AHEAD) return true;

    const { filter, items: videos } = playlistItems(playlist);
    if (!filter) return queued > 0;
    if (videos.length === 0) {
      warnOnce(playlist, 'none', 'Nothing in ' + playlist.name + ' yet (any of ' + filter.anyOf.join(', ') +
        '). Showing black until something is tagged.');
      return queued > 0;
    }
    clearWarning(playlist, 'none');

    while (queued < QUEUE_AHEAD) {
      let video;
      if (playlist.resumeAt) {
        const at = playlist.resumeAt;
        video = videos.find((v) => compareVideos(v, at) >= 0) || videos[0];
        playlist.resumeAt = null;
      } else {
        video = nextVideo(videos, playlist.lastQueued);
      }
      await mpv.command('loadfile', video.path, 'append-play');
      playlist.lastQueued = video;
      queued++;
    }
    return true;
  }

  // The filter is leaving the screen: when it comes back, start again at the
  // item it was on.
  function setAside(playlist) {
    playlist.resumeAt = playlist.nowPlaying;
    playlist.lastQueued = null;
    playlist.nowPlaying = null;
    playlist.filesById = {};
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
    CONFIG, videoRoot, OVERRIDE_PATH, STATUS_PATH, FILTERS_PATH, TAGS_PATH, QUEUE_AHEAD, PHOTOS, UPLOAD_TAG,
    isTagName, tagFromFolder, readBoxTags, items, tagsInUse,
    isFilterName, checkFilters, readFilters, readRawFilters, findFilter, filterItems,
    scheduledFilter, nextScheduleChange, whatToShow, parseOverride, parseDay, parseWeekdays, formatTime,
    createPlaylist, playlistItems, keepPlaying, setAside, compareNames, compareVideos, isVideoFile,
  };
}

module.exports = { createScheduler };
