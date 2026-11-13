// The box's website: shows what's on the TV and changes it for a while, as
// `show` did on the Mac. Served by the player at http://<box name>.local/.
// It only writes ~/video-scheduler/override.json; the player reads that file
// every second, so a change shows within a second or two.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const { Transform, pipeline: pipeStreams } = require('stream');
const { pipeline } = require('stream/promises');
const { createScheduler } = require('./logic.js');
const { addressUrl } = require('./address_code.js');

// How much of the log to show, and how much of its end to read for that.
const LOG_LINES = 20;
const LOG_TAIL_BYTES = 16 * 1024;

// Uploads: what each kind of file is sent as.
const CONTENT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
};
const MB = 1024 * 1024;
const GB = 1024 * MB;

// `options`: { config, videoRoot, now() -> Date, log, readText, writeText,
//              removeFile, listFolder, fileSize(path) -> bytes or null,
//              readTail(path, bytes) -> text or null,
//              startSync() -> false if a sync it started is still running,
//              freeBytes() -> bytes free on the SD card,
//              beforeRemove(path) -> promise, run before an upload is deleted,
//              readAddress() -> the box's IPv4 address or null }
// Uploads are written with Node's fs directly, as they are streamed to disk.
function createWebsite(options) {
  const { config, videoRoot, now, readText, writeText, removeFile, listFolder, readTail, startSync } = options;
  const log = options.log || (() => {});
  // The scheduler's functions, read quietly: the player logs what is wrong
  // with the filters and tags files.
  const logic = createScheduler(Object.assign({}, options, { log() {} }));
  const PHOTOS_DIR = videoRoot + '/' + logic.PHOTOS;
  const COUNTER_PATH = PHOTOS_DIR + '/.last-number';
  const limits = config.uploads;

  // Part files left by an upload cut off when the box stopped: no upload can
  // be under way yet, so every one is left over.
  try {
    for (const n of fs.readdirSync(PHOTOS_DIR)) {
      if (n.startsWith('.upload-')) fs.rmSync(PHOTOS_DIR + '/' + n, { force: true });
    }
  } catch (e) { /* no photos folder yet */ }

  // What can be picked under Play: every tag in use, and every filter.
  // What Play offers: every filter, and the tags in use that no GitHub filter
  // names (the GitHub videos play through their filters).
  function choices() {
    const filters = logic.readFilters();
    const github = new Set();
    for (const f of filters) {
      if (f.source === 'github') f.anyOf.concat(f.except || []).forEach((t) => github.add(t));
    }
    return { tags: logic.tagsInUse(logic.items()).filter((t) => !github.has(t)), filters: filters.map((f) => f.name) };
  }

  // Lets the player rebuild its queue for what is on screen. The change is
  // saved by then, so a problem here is logged, not the request's.
  async function filtersChanged() {
    if (!options.filtersChanged) return;
    try {
      await options.filtersChanged();
    } catch (e) {
      log("ERROR: Couldn't change what is queued: " + e.message);
    }
  }

  // ---------- Tags ----------

  // Saves the box's tags: only uploads' (box tags on videos from GitHub are dropped).
  function writeBoxTags(tags) {
    const kept = {};
    for (const p of Object.keys(tags).sort(logic.compareNames)) {
      if (p.startsWith(logic.PHOTOS + '/') && tags[p].length) kept[p] = tags[p];
    }
    writeText(logic.TAGS_PATH, JSON.stringify({ tags: kept }, null, 2) + '\n');
  }

  // The uploads, for tagging, with the shape the box measures for each
  // (null when it can't), and every tag in use (folder tags too, for the
  // filter editor).
  function listItems() {
    const list = logic.items();
    return {
      items: list.filter(isUpload).map((i) => ({
        path: i.path, group: i.group, folderTags: i.folderTags, boxTags: i.boxTags, kind: i.kind, shape: logic.shapeOf(i.file),
      })),
      tags: logic.tagsInUse(list),
    };
  }

  // An upload is in photos/ (a GitHub folder can't be: sync skips that name).
  function isUpload(item) {
    return item.path.startsWith(logic.PHOTOS + '/');
  }

  // A visitor's name as their tag, for the easy page: { tag } or { error }.
  // 'Aunt Sue' -> 'aunt-sue', 'José María' -> 'jose-maria'. Tags the box
  // uses for something else are refused; another visitor's are not, so the
  // same name adds to the same tag.
  const TAKEN = 'That name is taken by the box. Try adding your last name.';
  function visitorTag(name) {
    const text = typeof name === 'string' ? name.trim() : '';
    if (!text) return { error: 'Type your name first.' };
    const tag = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
    if (!tag) return { error: 'Use some letters or numbers in your name.' };
    return takenTag(tag) ? { error: TAKEN } : { tag };
  }
  // A tag the box uses for something else: the uploads', the shapes', or a
  // GitHub folder's.
  function takenTag(tag) {
    if ([logic.UPLOAD_TAG, 'portrait', 'landscape', 'square'].includes(tag)) return true;
    return logic.items().some((i) => !isUpload(i) && i.folderTags.includes(tag));
  }
  // null if an upload can carry `tag` (a tag a visitor's name gives), else the refusal.
  function checkVisitorTag(tag) {
    if (tag === undefined || tag === null) return null;
    if (!logic.isTagName(tag)) return fail('Not a tag name: ' + JSON.stringify(tag) + '. Use lowercase letters, digits and dashes.');
    return takenTag(tag) ? fail(TAKEN) : null;
  }

  // POST /api/tags { path, add | remove }: a box tag on an upload, no PIN.
  async function changeTag(body) {
    const rel = body && typeof body.path === 'string' ? body.path : '';
    const adding = typeof body.add === 'string';
    const tag = adding ? body.add : body.remove;
    if (typeof tag !== 'string') return fail('Bad request.');
    const item = logic.items().find((i) => i.path === rel);
    if (!item) return json(404, { error: 'No item ' + (rel || '(none)') + ' on the box.' });
    if (!isUpload(item)) return fail(rel + ' comes from GitHub: its tag comes from its folder there.');
    if (tag === logic.UPLOAD_TAG) return fail('upload is given to every upload by the box.');
    if (!logic.isTagName(tag)) return fail('Not a tag name: ' + JSON.stringify(tag) + '. Use lowercase letters, digits and dashes.');
    const tags = logic.readBoxTags();
    const own = (Array.isArray(tags[rel]) ? tags[rel] : []).filter((t) => logic.isTagName(t));
    if (adding) {
      if (!own.includes(tag)) own.push(tag);
    } else {
      const at = own.indexOf(tag);
      if (at !== -1) own.splice(at, 1);
    }
    tags[rel] = own;
    writeBoxTags(tags);
    log('Tags: ' + rel + (adding ? ' + ' : ' - ') + tag + ' (from the website).');
    await filtersChanged();
    return adding ? ok('Tagged ' + item.name + ' ' + tag + '.') : ok('Took ' + tag + ' off ' + item.name + '.');
  }

  // A removed upload's box tags go with it.
  function dropTags(rel) {
    const tags = logic.readBoxTags();
    if (!(rel in tags)) return;
    delete tags[rel];
    writeBoxTags(tags);
  }

  // The old My picks become favorites, once. picks.json is only removed
  // once the tags are saved; a problem is logged and tried again next start.
  const PICKS_PATH = videoRoot + '/picks.json';
  (function movePicks() {
    const text = readText(PICKS_PATH);
    if (text === null) return;
    try {
      const picks = JSON.parse(text).picks;
      if (!Array.isArray(picks)) throw new Error('no list of picks');
      const here = new Set(logic.items().filter(isUpload).map((i) => i.path));
      const tags = logic.readBoxTags();
      let moved = 0;
      for (const rel of picks) {
        if (typeof rel !== 'string' || !here.has(rel)) continue;
        const own = tags[rel] || [];
        if (!own.includes('favorites')) own.push('favorites');
        tags[rel] = own;
        moved++;
      }
      if (moved) writeBoxTags(tags);
      removeFile(PICKS_PATH);
      log('My picks are now tagged favorites (' + moved + ').');
    } catch (e) {
      log("ERROR: Couldn't turn the old My picks (" + PICKS_PATH + ') into favorites: ' + e.message);
    }
  })();

  // ---------- Filters ----------

  // The usable GitHub filters' names, lowercase -> as written (the same ones
  // the player plays, so a broken GitHub filter blocks no custom name).
  function githubNames() {
    return new Map(logic.readFilters().filter((f) => f.source === 'github').map((f) => [f.name.toLowerCase(), f.name]));
  }

  // Custom filters that are copies of GitHub ones (the starting filters setup
  // used to copy onto each box) are dropped, the first time GitHub filters are
  // here. Only once: a custom filter GitHub clashes with later is skipped, not
  // deleted, so nothing the person made is lost.
  const COPIES_DROPPED = videoRoot + '/.custom-copies-dropped';
  (function dropCustomCopies() {
    const github = githubNames();
    if (!github.size || readText(COPIES_DROPPED) !== null) return;
    writeText(COPIES_DROPPED, 'done\n');
    try {
      const { custom } = logic.readRawFilters();
      const kept = custom.filter((f) => !(f && typeof f.name === 'string' && github.has(f.name.toLowerCase())));
      if (kept.length === custom.length) return;
      for (const f of custom) {
        if (!kept.includes(f)) log('Dropping the custom filter ' + f.name + ': GitHub has a filter of that name.');
      }
      writeText(logic.FILTERS_PATH, JSON.stringify({ filters: kept }, null, 2) + '\n');
    } catch (e) {
      log("ERROR: Couldn't drop the custom copies of the GitHub filters: " + e.message);
    }
  })();

  // Custom filters saved without days and times (allowed before tags could be
  // played) are dropped when the website starts: their tags play from Play now.
  (function dropUnscheduled() {
    try {
      const { custom } = logic.readRawFilters();
      const kept = custom.filter((f) => !(f && typeof f.name === 'string' && (!Array.isArray(f.schedule) || !f.schedule.length)));
      if (kept.length === custom.length) return;
      for (const f of custom) {
        if (!kept.includes(f)) log('Dropping the custom filter ' + f.name + ': a filter needs days and times now; pick its tags under Play instead.');
      }
      writeText(logic.FILTERS_PATH, JSON.stringify({ filters: kept }, null, 2) + '\n');
    } catch (e) {
      log("ERROR: Couldn't drop the custom filters without days and times: " + e.message);
    }
  })();

  // POST /api/filters { filters }: replaces the box's filters, after
  // checking every one. No PIN, like the rest of the website.
  async function saveFilters(body) {
    if (!body || !Array.isArray(body.filters)) return fail('Bad request.');
    const checked = logic.checkFilters(body.filters);
    if (checked.errors.length) {
      const e = checked.errors[0];
      return fail((e.name || 'Filter ' + (e.index + 1)) + ': ' + e.error + '.');
    }
    // Custom filters can't take a GitHub filter's name.
    const github = githubNames();
    for (const f of body.filters) {
      const clash = github.get(f.name.toLowerCase());
      if (clash) return fail(f.name + ': GitHub has a filter called ' + clash + '; pick another name.');
    }
    const clean = body.filters.map((f) => {
      const out = { name: f.name, anyOf: f.anyOf, except: f.except || [], schedule: [] };
      for (const e of f.schedule || []) {
        const entry = {};
        if (e.from) { entry.from = e.from; entry.to = e.to; }
        if (e.weekdays && e.weekdays.length) entry.weekdays = e.weekdays;
        if (e.also && e.also.length) entry.also = e.also;
        if (e.times && e.times.length) entry.times = e.times.map((w) => ({ start: w.start, stop: w.stop }));
        out.schedule.push(entry);
      }
      return out;
    });
    writeText(logic.FILTERS_PATH, JSON.stringify({ filters: clean }, null, 2) + '\n');
    const names = clean.map((f) => f.name).join(', ');
    log('Filters changed (from the website): ' + (names || 'none') + '.');
    await filtersChanged();
    return ok('Saved ' + clean.length + (clean.length === 1 ? ' filter.' : ' filters.'));
  }

  // ---------- Uploads ----------

  function extensionOf(name) {
    return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  }

  // null if the box can take every one of `files` ({ name, bytes }),
  // otherwise the refusal.
  function checkFiles(files) {
    for (const f of files) {
      if (!logic.isVideoFile(f.name, true)) {
        return json(400, { error: 'Only JPEG or PNG photos and MP4, MOV or M4V videos can be added.' });
      }
      if (f.bytes > limits.maxBytes) {
        return json(413, { error: 'Too big: one file can be at most ' + gbText(limits.maxBytes) + '.' });
      }
    }
    const total = files.reduce((sum, f) => sum + f.bytes, 0);
    if (options.freeBytes() - total < limits.keepFreeBytes) {
      const what = files.length === 1 ? files[0].name : 'these ' + files.length + ' files';
      return json(507, { error: 'Not enough room on the box for ' + what + ': ' + gbText(limits.keepFreeBytes) + ' must stay free.' });
    }
    return null;
  }

  // The uploads, in the order they play.
  function uploadNames() {
    return (listFolder(PHOTOS_DIR) || []).filter((n) => logic.isVideoFile(n, true)).sort(logic.compareNames);
  }

  function listUploads() {
    return {
      uploads: uploadNames().map((name) => ({
        name,
        kind: config.photoExtensions.includes(extensionOf(name)) ? 'photo' : 'video',
        bytes: options.fileSize(PHOTOS_DIR + '/' + name),
      })),
    };
  }

  // Asked before a batch is sent, so a refusal shows before any file goes.
  function checkBatch(body) {
    const files = body && Array.isArray(body.files) ? body.files : null;
    const valid = files && files.length > 0 && files.every((f) =>
      f && typeof f.name === 'string' && Number.isInteger(f.bytes) && f.bytes >= 0);
    if (!valid) return fail('Bad request.');
    // From the easy page: the visitor's name.
    let tag;
    if (body.name !== undefined) {
      const v = visitorTag(body.name);
      if (v.error) return fail(v.error);
      tag = v.tag;
    }
    const refused = checkFiles(files);
    if (refused) return refused;
    const answer = { message: 'Ready to add ' + files.length + (files.length === 1 ? ' file.' : ' files.') };
    if (tag) answer.tag = tag;
    return json(200, answer);
  }

  // One file, streamed to a hidden part file and then numbered into place.
  // `stream` is not read at all when the upload is refused.
  // With `tag` (from the easy page) the saved file gets that box tag.
  async function receiveUpload({ name, length, stream, tag }) {
    if (typeof name !== 'string' || !Number.isInteger(length) || length < 0) return fail('Bad request.');
    const refused = checkVisitorTag(tag) || checkFiles([{ name, bytes: length }]);
    if (refused) return refused;

    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    const part = PHOTOS_DIR + '/.upload-' + crypto.randomBytes(6).toString('hex');
    let received = 0;
    const counter = new Transform({
      transform(chunk, encoding, done) {
        received += chunk.length;
        done(received > length ? new Error('more than was said') : null, chunk);
      },
    });
    // The phone going away is expected; the box failing to write is not.
    // Newer Node passes the phone's own error on to the file too, so that
    // one isn't the box failing to write.
    let failure = null;
    let dropped = null;
    stream.on('error', (e) => { dropped = e; });
    const out = fs.createWriteStream(part, { flags: 'wx' });
    out.on('error', (e) => { if (e !== dropped) failure = e; });
    try {
      await pipeline(stream, counter, out);
    } catch (e) {
      received = -1;
    }
    if (received !== length) {
      fs.rmSync(part, { force: true });
      if (failure) log('ERROR: Upload of ' + name + ' failed on the box: ' + failure.message);
      log('Upload of ' + name + ' stopped partway; nothing kept.');
      return fail('The upload of ' + name + ' stopped partway; nothing was kept.');
    }
    const saved = numberIntoPlace(part, name);
    log('Uploaded photos/' + saved + ' (' + (length / MB).toFixed(1) + ' MB)' + (tag ? ' for ' + tag : ''));
    if (tag) {
      const rel = logic.PHOTOS + '/' + saved;
      const tags = logic.readBoxTags();
      const own = (Array.isArray(tags[rel]) ? tags[rel] : []).filter((t) => logic.isTagName(t));
      if (!own.includes(tag)) own.push(tag);
      tags[rel] = own;
      writeBoxTags(tags);
      await filtersChanged();
    }
    return json(200, { message: 'Added ' + name + '.', saved });
  }

  // Gives the part file the next number. A link never overwrites, so two
  // uploads finishing at once can't take the same number. The last number
  // given is kept in a hidden file, so removing the newest upload never
  // frees its number: phones keep each upload's picture cached by its name.
  function numberIntoPlace(part, original) {
    const base = cleanName(original);
    for (;;) {
      let last = 0;
      try { last = Number(fs.readFileSync(COUNTER_PATH, 'utf8').trim()) || 0; } catch (e) { /* none yet */ }
      const highest = (listFolder(PHOTOS_DIR) || [])
        .map((n) => /^(\d+)-/.exec(n))
        .filter(Boolean)
        .reduce((max, m) => Math.max(max, Number(m[1])), last);
      const number = highest + 1;
      const final = String(number).padStart(5, '0') + '-' + base;
      try {
        fs.linkSync(part, PHOTOS_DIR + '/' + final);
        fs.rmSync(part, { force: true });
        // The upload is saved even if this fails: only log it.
        try {
          fs.writeFileSync(COUNTER_PATH + '.new', number + '\n');
          fs.renameSync(COUNTER_PATH + '.new', COUNTER_PATH);
        } catch (e) {
          log("ERROR: Couldn't save the upload counter: " + e.message);
        }
        return final;
      } catch (e) {
        if (e.code !== 'EEXIST') {
          fs.rmSync(part, { force: true });
          throw e;
        }
      }
    }
  }

  // 'Beach Day!!.MOV' -> 'beach-day.mov'; '写真.jpg' -> 'upload.jpg'.
  function cleanName(original) {
    const extension = extensionOf(original);
    const stem = original.slice(0, original.length - extension.length - 1)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .slice(0, 60)
      .replace(/^-+|-+$/g, '');
    return (stem || 'upload') + '.' + extension;
  }

  async function removeUpload(body) {
    const name = body && typeof body.name === 'string' ? body.name : '';
    if (!uploadNames().includes(name)) return json(404, { error: 'No upload named ' + name + '.' });
    const file = PHOTOS_DIR + '/' + name;
    if (options.beforeRemove) await options.beforeRemove(file);
    removeFile(file);
    log('Removed photos/' + name + ' (from the website)');
    dropTags(logic.PHOTOS + '/' + name);
    await filtersChanged();
    return ok('Removed ' + name + '.');
  }

  // POST /api/visitor/play { tag, keep: [name…] }: the easy page's last step.
  // Every other upload with the visitor's tag (from an earlier visit under
  // the same name) is deleted, so only `keep` is left under it, then the tag
  // plays until cleared. Refused, doing nothing, unless the tag is one a
  // visitor's name gives and every kept name is an upload with that tag.
  async function visitorPlay(body) {
    const tag = body ? body.tag : undefined;
    const keep = body && Array.isArray(body.keep) ? body.keep : null;
    if (typeof tag !== 'string' || checkVisitorTag(tag)) return fail('Bad request.');
    const tags = logic.readBoxTags();
    const has = (name) => Array.isArray(tags[logic.PHOTOS + '/' + name]) && tags[logic.PHOTOS + '/' + name].includes(tag);
    const names = uploadNames();
    if (!keep || !keep.length || !keep.every((n) => typeof n === 'string' && names.includes(n) && has(n))) return fail('Bad request.');
    for (const name of names.filter((n) => has(n) && !keep.includes(n))) {
      const file = PHOTOS_DIR + '/' + name;
      if (options.beforeRemove) await options.beforeRemove(file);
      removeFile(file);
      log('Removed photos/' + name + ' (' + tag + ' added new pictures)');
      dropTags(logic.PHOTOS + '/' + name);
    }
    await filtersChanged();
    return show({ tags: [tag], until: 'cleared' });
  }

  // What to send for GET /photos/<name>: { status, headers, path, start, end }
  // for the server to stream, or an answer with nothing to stream.
  function fileResponse(urlPath, range) {
    let name;
    try {
      name = decodeURIComponent(urlPath.split('?')[0].slice('/photos/'.length));
    } catch (e) {
      name = null;
    }
    if (!name || !uploadNames().includes(name)) return json(404, { error: 'Not found.' });
    const file = PHOTOS_DIR + '/' + name;
    const size = options.fileSize(file);
    if (size === null) return json(404, { error: 'Not found.' });
    const headers = {
      'Content-Type': CONTENT_TYPES[extensionOf(name)] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      // An upload's name never changes and is never reused.
      'Cache-Control': 'max-age=31536000, immutable',
    };
    const m = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (!m || (m[1] === '' && m[2] === '')) {
      return { status: 200, headers: Object.assign(headers, { 'Content-Length': size }), path: file, start: 0, end: size - 1 };
    }
    let start;
    let end;
    if (m[1] === '') {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) {
      return { status: 416, headers: { 'Content-Range': 'bytes */' + size }, body: '' };
    }
    return {
      status: 206,
      headers: Object.assign(headers, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': end - start + 1 }),
      path: file,
      start,
      end,
    };
  }

  // POST /api/show: { tags: [...], filters: [...], until } plays everything
  // with any of the tags plus everything the filters pick; { target: 'black' }.
  function show(body) {
    const black = body.target === 'black';
    let tags = [];
    let picked = [];
    if (!black) {
      tags = body.tags === undefined ? [] : body.tags;
      picked = body.filters === undefined ? [] : body.filters;
      if (!Array.isArray(tags) || !Array.isArray(picked)) return fail('Bad request.');
      tags = Array.from(new Set(tags));
      picked = Array.from(new Set(picked));
      if (!tags.length && !picked.length) return fail('Pick one or more tags or filters to play.');
      const inUse = logic.tagsInUse(logic.items());
      const unknownTag = tags.find((t) => !inUse.includes(t));
      if (unknownTag !== undefined) return fail('No tag called ' + String(unknownTag) + ' on the box.');
      const filters = logic.readFilters();
      const unknownFilter = picked.find((n) => !logic.findFilter(filters, n));
      if (unknownFilter !== undefined) return fail('No filter called ' + String(unknownFilter) + ' on the box.');
    }

    const until = body.until === undefined ? 'schedule' : body.until;
    const minutes = Number(until);
    if (until !== 'schedule' && until !== 'cleared' && !(Number.isInteger(minutes) && minutes > 0)) {
      return fail('Not a number of minutes: ' + until);
    }

    const at = now();
    const override = {
      tags: black ? null : tags,
      filters: black ? [] : picked,
      setAt: at.getTime(),
      expires: until === 'schedule' || until === 'cleared' ? null : at.getTime() + minutes * 60 * 1000,
      untilCleared: until === 'cleared',
    };
    const text = JSON.stringify(override) + '\n';
    if (!logic.parseOverride(text).ok) return fail('Bad request.');
    writeText(logic.OVERRIDE_PATH, text);

    const label = black ? 'black' : logic.pickName(tags, picked);
    if (until === 'schedule') return ok('Showing ' + label + ' until the schedule next changes.');
    if (until === 'cleared') return ok('Showing ' + label + ' until you choose Back to schedule.');
    return ok('Showing ' + label + ' until ' + logic.formatTime(new Date(override.expires), at) +
      ', then back to the schedule.');
  }

  // POST /api/screen { orientation }: the TV was turned on its mount. No PIN,
  // like Play. The player turns the picture within a second.
  function turnScreen(body) {
    const orientation = body && body.orientation;
    if (!logic.ORIENTATIONS.includes(orientation)) return fail('The TV is portrait or landscape.');
    writeText(logic.SCREEN_PATH, JSON.stringify({ orientation }) + '\n');
    log('Screen: ' + orientation + ' (from the website).');
    return ok('The picture is turned for a ' + orientation + ' TV.');
  }

  // GET /api/address-code: whether the TV shows the address code, and the
  // address. POST { show }: switches it, with no PIN, like the TV buttons.
  function addressCode() {
    const address = options.readAddress ? options.readAddress() : null;
    return { show: logic.addressCodeOn(), url: addressUrl(address, config.box.webPort) };
  }
  function switchAddressCode(body) {
    const show = body && body.show;
    if (show !== true && show !== false) return fail('Say true or false.');
    writeText(logic.ADDRESS_CODE_PATH, JSON.stringify({ show }) + '\n');
    log('Address code on the TV: ' + (show ? 'on' : 'off') + ' (from the website).');
    return ok(show ? 'The TV shows the address as each item starts.' : "The TV doesn't show the address.");
  }

  async function handle({ method, path, headers, body }) {
    const route = method + ' ' + path.split('?')[0];
    if (route === 'GET /') return { status: 200, type: 'text/html', body: EASY_PAGE };
    if (route === 'GET /advanced') return { status: 200, type: 'text/html', body: PAGE };
    if (route === 'GET /api/status') {
      const text = readText(logic.STATUS_PATH);
      return json(200, { status: text === null ? null : text.trim() });
    }
    if (route === 'GET /api/choices') return json(200, choices());
    if (route === 'GET /api/uploads') return json(200, listUploads());
    if (route === 'GET /api/items') return json(200, listItems());
    if (route === 'GET /api/filters') return json(200, logic.readRawFilters());
    if (route === 'GET /api/screen') return json(200, { orientation: logic.readScreen() });
    if (route === 'GET /api/address-code') return json(200, addressCode());
    if (route === 'POST /api/address-code') {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return fail('Bad request.'); }
      return switchAddressCode(parsed);
    }
    if (route === 'POST /api/screen') {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return fail('Bad request.'); }
      return turnScreen(parsed);
    }
    if (route === 'POST /api/tags' || route === 'POST /api/filters') {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return fail('Bad request.'); }
      if (!parsed || typeof parsed !== 'object') return fail('Bad request.');
      return route === 'POST /api/tags' ? changeTag(parsed) : saveFilters(parsed);
    }
    if (route === 'POST /api/uploads/check' || route === 'POST /api/uploads/remove') {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return fail('Bad request.'); }
      return route === 'POST /api/uploads/check' ? checkBatch(parsed) : removeUpload(parsed);
    }
    if (route === 'GET /api/log') {
      const text = readTail(videoRoot + '/scheduler.log', LOG_TAIL_BYTES);
      const lines = text === null ? [] : text.split('\n').filter((l) => l.trim() !== '');
      // The first line may be cut off where the read started, unless the
      // whole log fit.
      if (text !== null && text.length >= LOG_TAIL_BYTES) lines.shift();
      return json(200, { lines: lines.slice(-LOG_LINES) });
    }
    if (route === 'POST /api/sync') {
      return startSync()
        ? ok('Checking GitHub for new videos. New ones play within a minute or two; watch Recent activity below.')
        : ok('Already checking for new videos.');
    }
    if (route === 'POST /api/schedule') {
      removeFile(logic.OVERRIDE_PATH);
      return ok('Override cancelled. Following the schedule.');
    }
    if (route === 'POST /api/show' || route === 'POST /api/visitor/play') {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return fail('Bad request.'); }
      if (!parsed || typeof parsed !== 'object') return fail('Bad request.');
      return route === 'POST /api/show' ? show(parsed) : visitorPlay(parsed);
    }
    return json(404, { error: 'Not found.' });
  }

  return { handle, choices, receiveUpload, fileResponse };
}

function gbText(bytes) {
  return Math.round((bytes / GB) * 10) / 10 + ' GB';
}

function json(status, value) {
  return { status, type: 'application/json', body: JSON.stringify(value) };
}
function ok(message) { return json(200, { message }); }
function fail(error) { return json(400, { error }); }

// Serves the website. A failure to listen is logged, not fatal: the TV
// keeps playing without it.
function startWebsite(options, port) {
  const site = createWebsite(Object.assign({
    startSync: syncStarter(options),
    freeBytes: () => {
      const s = fs.statfsSync(options.videoRoot);
      return s.bavail * s.bsize;
    },
  }, options));
  // No overall time limit, so a big upload on slow Wi-Fi isn't cut off.
  const server = http.createServer({ requestTimeout: 0 }, (req, res) => {
    const send = (r) => {
      if (res.headersSent || res.destroyed) return;
      res.writeHead(r.status, { 'Content-Type': r.type + '; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(r.body);
    };
    const failed = (e) => {
      options.log('ERROR: Website: ' + e.message);
      send(json(500, { error: 'Something went wrong on the box.' }));
    };
    const urlPath = req.url.split('?')[0];

    if ((req.method === 'GET' || req.method === 'HEAD') && urlPath.startsWith('/photos/')) {
      const r = site.fileResponse(urlPath, req.headers.range);
      if (r.type) return send(r);
      res.writeHead(r.status, r.headers);
      if (!r.path || r.end < r.start || req.method === 'HEAD') return res.end();
      // pipeline closes the file if the phone stops reading partway.
      pipeStreams(fs.createReadStream(r.path, { start: r.start, end: r.end }), res, () => {});
      return undefined;
    }

    // An upload: the file is the body, streamed to disk, never held in memory.
    if (req.method === 'POST' && urlPath === '/api/uploads') {
      const m = /[?&]name=([^&]*)/.exec(req.url);
      let name = null;
      try { name = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null; } catch (e) { name = null; }
      const t = /[?&]tag=([^&]*)/.exec(req.url);
      let tag;
      try { tag = t ? decodeURIComponent(t[1]) : undefined; } catch (e) { tag = ''; }
      const length = Number(req.headers['content-length']);
      if (!name || !Number.isInteger(length)) return send(json(400, { error: 'Bad request.' }));
      site.receiveUpload({ name, length, stream: req, tag }).then(send, failed);
      return undefined;
    }

    // A list of filters can be long; anything else is small.
    const cap = urlPath === '/api/filters' ? 200000 : 10000;
    let body = '';
    let tooLong = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (tooLong) return;
      body += chunk;
      if (body.length > cap) tooLong = true;
    });
    req.on('end', () => {
      if (tooLong) {
        return send(json(413, { error: urlPath === '/api/filters' ? 'That list of filters is too long.' : 'That request is too long.' }));
      }
      site.handle({ method: req.method, path: req.url, headers: req.headers, body }).then(send, failed);
    });
    return undefined;
  });
  // A connection that sends nothing for two minutes is closed.
  server.timeout = 120000;
  server.on('error', (e) => options.log('ERROR: Website on port ' + port + ': ' + e.message));
  server.listen(port, () => options.log('Website: http://' + require('os').hostname() + '.local' +
    (port === 80 ? '' : ':' + port) + '/'));
  return server;
}

// Starts ~/video-scheduler/sync with its output appended to the log, as the
// hourly timer does. Returns false while a sync it started is still running.
// (The sync's own lock also keeps it from overlapping the timer's.)
function syncStarter(options) {
  const { spawn } = require('child_process');
  let running = false;
  return () => {
    if (running) return false;
    const out = fs.openSync(options.videoRoot + '/scheduler.log', 'a');
    let child;
    try {
      child = spawn(options.videoRoot + '/sync', [], { stdio: ['ignore', out, out] });
    } finally {
      fs.closeSync(out);
    }
    running = true;
    child.on('error', (e) => {
      running = false;
      options.log("ERROR: Couldn't start sync: " + e.message);
    });
    child.on('exit', () => { running = false; });
    return true;
  };
}

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tvBox</title>
<style>
  :root { color-scheme: dark; --bg: #121212; --card: #1e1e1e; --text: #f2f2f2; --dim: #a0a0a0; --accent: #ff8a1f; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 17px/1.4 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
  main { max-width: 480px; margin: 0 auto; padding: 20px 16px 40px; }
  h1 { font-size: 22px; margin: 0 0 14px; }
  h2 { font-size: 15px; font-weight: 600; color: var(--dim); text-transform: uppercase; letter-spacing: .04em; margin: 22px 0 8px; }
  .card { background: var(--card); border-radius: 12px; padding: 14px 16px; }
  .now { margin-bottom: 12px; }
  #status { font-weight: 600; }
  button.current { border-color: var(--accent); outline: 3px solid var(--accent); outline-offset: 2px; }
  button.picked { background: #4a3317; border-color: var(--accent); }
  .playrow { margin-top: 12px; }
  .picks:empty { display: none; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  button, select { font: inherit; color: var(--text); background: #2c2c2c; border: 1px solid #3a3a3a; border-radius: 10px; padding: 12px; width: 100%; }
  button { cursor: pointer; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #1a1a1a; font-weight: 600; }
  .row { display: flex; gap: 10px; }
  .row > * { flex: 1; }
  #message { min-height: 1.4em; margin-top: 10px; color: var(--accent); }
  #message.error { color: #ff6b6b; }
  #log { font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--dim); white-space: pre-wrap; word-break: break-word; }
  input[type=password] { font: inherit; color: var(--text); background: #2c2c2c; border: 1px solid #3a3a3a; border-radius: 10px; padding: 12px; width: 100%; margin-bottom: 10px; }
  .pick { display: block; position: relative; text-align: center; background: var(--accent); color: #1a1a1a; font-weight: 600; border-radius: 10px; padding: 12px; cursor: pointer; }
  .pick input { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
  #progress { font-size: 14px; color: var(--dim); margin-top: 8px; }
  .tagrow .thumbbox { position: relative; flex: none; }
  .tagrow .thumb { display: block; width: 44px; height: 44px; object-fit: cover; border-radius: 6px; background: #000; }
  .tagrow .shape { position: absolute; left: 2px; bottom: 2px; padding: 0 3px; font-size: 9px; line-height: 13px; border-radius: 3px; color: #fff; background: rgba(0, 0, 0, 0.7); white-space: nowrap; }
  .tagrow .remove { width: auto; padding: 4px 10px; font-size: 13px; }
  .group { font-size: 13px; color: var(--dim); margin: 12px 0 4px; }
  .group:first-child { margin-top: 0; }
  .hint { font-size: 14px; color: var(--dim); margin-bottom: 10px; }
  .switch { display: flex; align-items: center; gap: 8px; margin: 14px 0 4px; }
  .switch input { width: 20px; height: 20px; }
  .note { font-size: 14px; color: var(--accent); margin-top: 8px; }
  .note:empty { display: none; }
  .note.error { color: #ff6b6b; }
  button:disabled { opacity: .45; cursor: default; }
  button:active:not(:disabled) { transform: scale(.96); filter: brightness(1.2); }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; margin: 2px 4px 2px 0; border-radius: 12px; background: #2c2c2c; font-size: 13px; }
  .chip.fixed { color: var(--dim); }
  .chip button { width: auto; padding: 0 2px; border: none; background: none; font-size: 15px; line-height: 1; color: var(--dim); }
  .tagrow { padding: 8px 0; border-top: 1px solid #2c2c2c; }
  .tagrow .top { display: flex; align-items: center; gap: 8px; }
  .tagrow .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tagrow .star { width: auto; padding: 2px 8px; font-size: 20px; color: var(--accent); background: none; border: none; }
  .tagrow .add, .editor .add { display: flex; gap: 6px; margin-top: 4px; }
  .tagrow .add input, .editor input[type=text] { font: inherit; font-size: 14px; color: var(--text); background: #2c2c2c; border: 1px solid #3a3a3a; border-radius: 8px; padding: 6px 8px; flex: 1; min-width: 0; width: 100%; }
  .tagrow .add button { width: auto; padding: 6px 12px; }
  .filterrow { padding: 8px 0; border-top: 1px solid #2c2c2c; }
  .filterrow .top { display: flex; align-items: center; gap: 6px; }
  .filterrow .name { flex: 1; font-weight: 600; }
  .filterrow button, .editor button { width: auto; padding: 6px 10px; font-size: 14px; margin: 4px 4px 0 0; }
  .filterrow .what { font-size: 13px; color: var(--dim); }
  .editor { border: 1px solid #3a3a3a; border-radius: 10px; padding: 10px; margin: 8px 0; }
  .editor label { display: block; font-size: 14px; color: var(--dim); margin: 8px 0 4px; }
  .editor .ticks label { display: inline-flex; align-items: center; gap: 4px; margin: 2px 10px 2px 0; color: var(--text); }
  .editor .entry { border-top: 1px dashed #3a3a3a; margin-top: 8px; padding-top: 6px; }
  #filter-save { margin-top: 10px; }
  h1 .other { float: right; font-size: 15px; font-weight: 400; color: var(--accent); margin-top: 4px; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <h1>tvBox <a class="other" href="/">Easy page</a></h1>

  <h2>Play</h2>
  <div class="card">
    <div class="now" role="status">Now: <span id="status">Checking…</span></div>
    <div class="hint">Pick one or more, then tap Play.</div>
    <div class="group" id="taglabel">Tags</div>
    <div class="grid picks" id="tagpicks"></div>
    <div class="group">Filters</div>
    <div class="grid picks" id="filterpicks"></div>
    <div class="grid playrow"><button class="primary" id="play-picked" disabled>Play</button><button id="black" data-choice="black">Black</button></div>
  </div>
  <div id="message"></div>

  <h2>For how long</h2>
  <select id="until">
    <option value="schedule">Until the schedule changes</option>
    <option value="15">15 minutes</option>
    <option value="30">30 minutes</option>
    <option value="60">60 minutes</option>
    <option value="cleared" selected>Until switched back</option>
  </select>

  <h2>TV</h2>
  <div class="card">
    <div class="hint">Turned the TV on its mount? Tap the way it faces now, and the picture turns to match.</div>
    <div class="grid"><button data-tv="portrait">Portrait</button><button data-tv="landscape">Landscape</button></div>
    <label class="switch"><input id="addresscode" type="checkbox"> Show the box's address on the TV</label>
    <div class="hint" id="address"></div>
  </div>

  <h2>Photos and videos</h2>
  <div class="card">
    <label class="pick">Add photos or videos<input id="files" type="file" accept="image/*,video/*" multiple></label>
    <div id="progress"></div>
    <div class="hint">Tap ☆ to add one to Favorites, or add any tag to put it in the filters with that tag. Each change is saved straight away. Videos from GitHub take their tags from their folders there.</div>
    <div id="taglist">Loading…</div>
    <datalist id="tagnames"></datalist>
  </div>

  <h2>Filters</h2>
  <div class="card">
    <div class="hint">A filter plays everything with any of its tags, except its "except" tags. Your own filters come first: where schedules overlap, the higher filter wins. Changes need Save filters.</div>
    <div class="group">Yours</div>
    <div id="filterlist">Loading…</div>
    <div id="filter-editor" class="editor" hidden></div>
    <button id="filter-new">New filter</button>
    <button class="primary" id="filter-save">Save filters</button>
    <div id="filter-note" class="note" role="status" aria-live="polite"></div>
    <div class="group">From GitHub</div>
    <div class="hint">The same on every box, and changed there: they come with the videos, within the hour.</div>
    <div id="githubfilters">Loading…</div>
  </div>

  <h2>Schedule</h2>
  <button class="primary" id="schedule">Back to schedule</button>

  <h2>New videos from GitHub</h2>
  <div class="card">
    <div class="hint">The box checks GitHub for new videos every hour by itself. New ones play within a minute or two; ones taken out are set aside on the box, not deleted. Your uploads, tags and filters aren't touched, and the box's own software doesn't change.</div>
    <button id="sync">Check for new videos now</button>
    <div id="sync-note" class="note" role="status" aria-live="polite"></div>
  </div>

  <h2>Recent activity</h2>
  <div class="card"><div id="log">Loading…</div></div>
</main>
<script>
  const $ = (id) => document.getElementById(id);
  const say = (text, error) => { $('message').textContent = text; $('message').className = error ? 'error' : ''; };

  // Sends a request and shows the answer in the message line, unless
  // quiet (the caller shows it next to its own button).
  async function post(path, body, quiet) {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      const data = await r.json();
      if (!quiet) say(data.message || data.error, !r.ok);
      setTimeout(refresh, 1500);
      return Object.assign({ ok: r.ok }, data);
    } catch (e) {
      if (!quiet) say("Couldn't reach the box.", true);
      return { ok: false, error: "Couldn't reach the box." };
    }
  }
  const show = (target) => post('/api/show', { target, until: $('until').value });

  function button(text, onClick, cls) {
    const b = document.createElement('button');
    b.textContent = text;
    if (cls) b.className = cls;
    b.onclick = onClick;
    return b;
  }

  // Changes an element's text only when it differs, so a screen reader
  // doesn't read a status line out again on every poll.
  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }

  // Outlines the Play button for what is on the window (none for null).
  function outline(on) {
    for (const b of document.querySelectorAll('button[data-choice]')) {
      const yes = on.includes(b.dataset.choice);
      b.classList.toggle('current', yes);
      if (yes) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
  }

  // Outlines the way the box has the TV facing.
  function markScreen(orientation) {
    for (const b of document.querySelectorAll('button[data-tv]')) {
      const yes = b.dataset.tv === orientation;
      b.classList.toggle('current', yes);
      b.setAttribute('aria-pressed', yes ? 'true' : 'false');
    }
  }
  for (const b of document.querySelectorAll('button[data-tv]')) {
    b.onclick = async () => { if ((await post('/api/screen', { orientation: b.dataset.tv })).ok) markScreen(b.dataset.tv); };
  }

  // The address code switch, and the address written beside it.
  $('addresscode').onchange = () => post('/api/address-code', { show: $('addresscode').checked });
  async function refresh() {
    try {
      markScreen((await (await fetch('/api/screen')).json()).orientation);
      const a = await (await fetch('/api/address-code')).json();
      $('addresscode').checked = a.show;
      setText($('address'), a.url ? 'The address: ' + a.url + ' (a QR code of it shows in the corner of the TV as each item starts).' : 'No network address.');
    } catch (e) { /* the status line says when the box can't be reached */ }
    try {
      const r = await (await fetch('/api/status')).json();
      setText($('status'), r.status || 'The box has not started yet.');
      // playingChoices is in the second script block, loaded by the time this runs (after an await).
      outline(playingChoices(r.status, filterNames));
    } catch (e) { setText($('status'), "Couldn't reach the box."); outline([]); }
    try {
      const l = await (await fetch('/api/log')).json();
      $('log').textContent = l.lines.length ? l.lines.join('\\n') : 'Nothing yet.';
    } catch (e) { /* the status line already says the box can't be reached */ }
  }

  let filterNames = []; // the box's filters, for outlining the playing ones
  const picked = new Set(); // what is selected under Play: '#tag' or a filter's name

  // A button that selects or unselects the choice without showing anything.
  function pickButton(text, choice) {
    const b = button(text, () => {
      if (picked.has(choice)) picked.delete(choice); else picked.add(choice);
      b.classList.toggle('picked', picked.has(choice));
      b.setAttribute('aria-pressed', String(picked.has(choice)));
      $('play-picked').disabled = !picked.size;
    });
    b.dataset.choice = choice;
    b.classList.toggle('picked', picked.has(choice));
    b.setAttribute('aria-pressed', String(picked.has(choice)));
    return b;
  }

  // The Play section: a button per tag and per filter (custom first), to pick
  // several and play them together.
  async function load() {
    const c = await (await fetch('/api/choices')).json();
    const offered = c.tags.map((t) => '#' + t).concat(c.filters);
    for (const x of Array.from(picked)) if (!offered.includes(x)) picked.delete(x); // keep picks still offered
    $('play-picked').disabled = !picked.size;
    $('tagpicks').textContent = '';
    $('filterpicks').textContent = '';
    filterNames = c.filters;
    $('taglabel').hidden = !c.tags.length; // no heading over an empty row
    for (const tag of c.tags) $('tagpicks').appendChild(pickButton(tagLabel(tag), '#' + tag));
    for (const name of c.filters) $('filterpicks').appendChild(pickButton(name, name));
    refresh();
  }

  $('play-picked').onclick = async () => {
    const choice = Array.from(picked);
    const tags = choice.filter((x) => x.startsWith('#')).map((x) => x.slice(1));
    const filters = choice.filter((x) => !x.startsWith('#'));
    const r = await post('/api/show', { tags, filters, until: $('until').value });
    if (r.ok) {
      picked.clear();
      for (const b of document.querySelectorAll('.picks button')) { b.classList.remove('picked'); b.setAttribute('aria-pressed', 'false'); }
      $('play-picked').disabled = !picked.size;
    }
  };

  // ---- Adding and removing photos ----

  // A PIN kept by an older page is no longer needed.
  try { localStorage.removeItem('tvbox-upload-pin'); } catch (e) { /* nothing kept */ }

  const api = {
    async check(files) {
      try {
        const r = await fetch('/api/uploads/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: files.map((f) => ({ name: f.name, bytes: f.size })) }),
        });
        const d = await r.json();
        return { ok: r.ok, message: d.message, error: d.error };
      } catch (e) { return { ok: false, error: "Couldn't reach the box." }; }
    },
    upload(file, onProgress) {
      return new Promise((resolve) => {
        const x = new XMLHttpRequest();
        x.open('POST', '/api/uploads?name=' + encodeURIComponent(file.name));
        x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total)); };
        x.onload = () => {
          let d = {};
          try { d = JSON.parse(x.responseText); } catch (e) { /* no answer */ }
          resolve({ ok: x.status === 200, message: d.message, error: d.error || 'The box refused it.' });
        };
        x.onerror = () => resolve({ ok: false, error: 'The upload stopped. Keep this page open while it sends, then try again.' });
        x.send(file);
      });
    },
  };

  const rows = {};
  const ui = {
    say,
    progress(name, text) {
      if (!rows[name]) {
        rows[name] = document.createElement('div');
        $('progress').appendChild(rows[name]);
      }
      rows[name].textContent = name + ': ' + text;
    },
  };

  $('files').onchange = async () => {
    const files = Array.from($('files').files);
    $('files').value = '';
    if (!files.length) return;
    $('progress').textContent = '';
    for (const k of Object.keys(rows)) delete rows[k];
    await sendBatch(files, api, ui);
    loadItems();
  };

  async function removeUpload(name) {
    try {
      const r = await fetch('/api/uploads/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      say(d.message || d.error, !r.ok);
    } catch (e) { say("Couldn't reach the box.", true); }
    loadItems();
  }

  // ---- Tags ----

  let tagNames = []; // every tag in use, for suggestions and the filter editor
  const tagNotes = {}; // path -> { text, error }: each row's last answer, kept when the list is redrawn

  const typed = {}; // path -> text typed in its add-a-tag field, kept across redraws
  // The note of the row for path, as the page is now (rows are redrawn).
  function rowNote(path) {
    const row = Array.from(document.querySelectorAll('.tagrow')).find((r) => r.dataset.path === path);
    return row ? row.querySelector('.note') : null;
  }

  async function changeTag(path, change) {
    const show = (text, error) => {
      tagNotes[path] = { text, error };
      const note = rowNote(path);
      if (note) { note.className = 'note' + (error ? ' error' : ''); setText(note, text); }
    };
    show('Saving…', false);
    const r = await post('/api/tags', Object.assign({ path }, change), true);
    show(r.ok ? '✓ ' + r.message : r.error, !r.ok);
    if (r.ok) {
      if (change.add) delete typed[path];
      loadItems();
    }
  }

  function chip(text, onRemove) {
    const c = document.createElement('span');
    c.className = 'chip' + (onRemove ? '' : ' fixed');
    c.textContent = text;
    if (onRemove) {
      const x = document.createElement('button');
      x.textContent = '×';
      x.setAttribute('aria-label', 'Take ' + text + ' off');
      x.onclick = onRemove;
      c.appendChild(x);
    }
    return c;
  }

  async function loadItems() {
    try {
      const d = await (await fetch('/api/items')).json();
      tagNames = d.tags;
      load().catch(() => {}); // the tags in use may have changed: offer them under Play
      $('tagnames').textContent = '';
      for (const t of d.tags) {
        const o = document.createElement('option');
        o.value = t;
        $('tagnames').appendChild(o);
      }
      const list = $('taglist');
      list.textContent = d.items.length ? '' : 'Nothing added yet.';
      let group = null;
      for (const item of d.items) {
        if (item.group !== group) {
          group = item.group;
          const h = document.createElement('div');
          h.className = 'group';
          h.textContent = group;
          list.appendChild(h);
        }
        const row = document.createElement('div');
        row.className = 'tagrow';
        row.dataset.path = item.path;
        const name = item.path.split('/').pop();
        const src = '/photos/' + encodeURIComponent(name);
        row.innerHTML = '<div class="top">' +
          '<span class="thumbbox">' +
          (item.kind === 'photo' ? '<img class="thumb" loading="lazy" alt="">' : '<video class="thumb" preload="metadata" muted playsinline></video>') +
          '<span class="shape" hidden></span></span>' +
          '<button class="star"></button><span class="name"></span><button class="remove">Remove</button></div>' +
          '<div class="chips"></div><div class="add"><input list="tagnames" placeholder="add a tag"><button>Add</button></div>' +
          '<div class="note" role="status"></div>';
        const note = row.querySelector('.note');
        if (tagNotes[item.path]) {
          note.textContent = tagNotes[item.path].text;
          note.className = 'note' + (tagNotes[item.path].error ? ' error' : '');
        }
        const fav = item.boxTags.includes('favorites');
        const star = row.querySelector('.star');
        star.textContent = fav ? '★' : '☆';
        star.setAttribute('aria-label', fav ? 'Take out of Favorites' : 'Add to Favorites');
        star.onclick = () => changeTag(item.path, fav ? { remove: 'favorites' } : { add: 'favorites' });
        row.querySelector('.thumb').src = item.kind === 'photo' ? src : src + '#t=0.1';
        row.querySelector('.name').textContent = name;
        // The shape the box measured, unless a portrait or landscape tag says otherwise.
        if (!item.boxTags.includes('portrait') && !item.boxTags.includes('landscape')) {
          const mark = row.querySelector('.shape');
          mark.textContent = item.shape || '?';
          mark.title = item.shape ? 'The box measures this as ' + item.shape + '.'
            : "The box can't tell its shape: tag it portrait or landscape to play it.";
          mark.hidden = false;
        }
        row.querySelector('.remove').onclick = () => removeUpload(name);
        const chips = row.querySelector('.chips');
        for (const t of item.folderTags) chips.appendChild(chip(t));
        for (const t of item.boxTags) chips.appendChild(chip(t, () => changeTag(item.path, { remove: t })));
        const input = row.querySelector('.add input');
        input.value = typed[item.path] || '';
        input.oninput = () => { typed[item.path] = input.value; };
        const add = () => { const t = input.value.trim(); if (t) changeTag(item.path, { add: t }); };
        row.querySelector('.add button').onclick = add;
        input.onkeydown = (e) => { if (e.key === 'Enter') add(); };
        list.appendChild(row);
      }
    } catch (e) { /* the status line already says the box can't be reached */ }
  }

  // ---- Filters ----

  let filters = []; // as saved on the box, plus any changes not saved yet
  let editing = -1; // the filter open in the editor, or -1 for a new one
  const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const timesText = (times) => (times || []).map((w) => w.start + '-' + w.stop).join(', ');
  function describe(f) {
    let text = 'Any of ' + f.anyOf.join(', ');
    if ((f.except || []).length) text += ', except ' + f.except.join(', ');
    const entries = (f.schedule || []).map((e) => {
      let days = e.from ? e.from + ' to ' + e.to : '';
      if ((e.weekdays || []).length) days += ' (' + e.weekdays.join('/') + ')';
      if ((e.also || []).length) days += (days ? ' plus ' : '') + e.also.join(', ');
      return days + ': ' + (timesText(e.times) || 'all day');
    });
    return text + '. ' + (entries.length ? entries.join('; ') : 'Not scheduled: only when chosen.');
  }

  function noteFilters(text, error) {
    $('filter-note').className = 'note' + (error ? ' error' : '');
    setText($('filter-note'), text);
  }

  function drawFilters() {
    const list = $('filterlist');
    list.textContent = filters.length ? '' : 'None yet: New filter makes one.';
    filters.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'filterrow';
      row.innerHTML = '<div class="top"><span class="name"></span></div><div class="what"></div>';
      row.querySelector('.name').textContent = f.name;
      row.querySelector('.what').textContent = describe(f);
      const top = row.querySelector('.top');
      const act = (text, label, fn) => { const b = button(text, fn); b.setAttribute('aria-label', label + ' ' + f.name); top.appendChild(b); };
      act('↑', 'Move up', () => { filters = moveFilter(filters, i, -1); changed(); });
      act('↓', 'Move down', () => { filters = moveFilter(filters, i, 1); changed(); });
      act('Edit', 'Edit', () => openEditor(i));
      act('Delete', 'Delete', () => { filters = filters.filter((x, j) => j !== i); changed(); });
      list.appendChild(row);
    });
  }

  function changed() {
    editing = -1;
    $('filter-editor').hidden = true;
    drawFilters();
    noteFilters('Not saved yet: tap Save filters.');
  }

  function ticks(chosen) {
    const box = document.createElement('div');
    box.className = 'ticks';
    for (const t of Array.from(new Set(tagNames.concat(chosen)))) {
      const l = document.createElement('label');
      l.innerHTML = '<input type="checkbox">';
      l.firstChild.dataset.tag = t;
      l.firstChild.checked = chosen.includes(t);
      l.appendChild(document.createTextNode(t));
      box.appendChild(l);
    }
    return box;
  }

  function entryForm(e) {
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = '<label>From and to (e.g. 10-01 and 10-31, or 11-01 and 11-4thu)</label><div class="add"><input type="text" class="from"><input type="text" class="to"></div>' +
      '<label>Only on</label><div class="ticks wk"></div>' +
      '<label>Extra days (e.g. 11-4thu-1, 2026-12-24)</label><input type="text" class="also">' +
      '<label>Times (e.g. 05:00-07:00, 17:00-19:30; empty for all day)</label><input type="text" class="times">';
    div.querySelector('.from').value = e.from || '';
    div.querySelector('.to').value = e.to || '';
    div.querySelector('.also').value = (e.also || []).join(', ');
    div.querySelector('.times').value = timesText(e.times);
    for (const d of WEEK) {
      const l = document.createElement('label');
      l.innerHTML = '<input type="checkbox">';
      l.firstChild.dataset.day = d;
      l.firstChild.checked = (e.weekdays || []).includes(d);
      l.appendChild(document.createTextNode(d));
      div.querySelector('.wk').appendChild(l);
    }
    div.appendChild(button('Remove these days', () => div.remove()));
    return div;
  }

  // The editor's fields, read back as a filter.
  function readEditor(ed) {
    const words = (text) => text.split(',').map((x) => x.trim()).filter(Boolean);
    const chosen = (sel) => Array.from(ed.querySelectorAll(sel + ' input:checked')).map((x) => x.dataset.tag);
    return {
      name: ed.querySelector('.fname').value.trim(),
      anyOf: Array.from(new Set(chosen('.any').concat(words(ed.querySelector('.anymore').value)))),
      except: chosen('.except'),
      schedule: Array.from(ed.querySelectorAll('.entry')).map((div) => {
        const e = {};
        const from = div.querySelector('.from').value.trim();
        const to = div.querySelector('.to').value.trim();
        if (from || to) { e.from = from; e.to = to; }
        const wk = Array.from(div.querySelectorAll('.wk input:checked')).map((x) => x.dataset.day);
        if (wk.length) e.weekdays = wk;
        const also = words(div.querySelector('.also').value);
        if (also.length) e.also = also;
        const times = words(div.querySelector('.times').value).map((w) => {
          const parts = w.split('-').map((x) => x.trim());
          return { start: parts[0] || '', stop: parts[1] || '' };
        });
        if (times.length) e.times = times;
        return e;
      }),
    };
  }

  function openEditor(i) {
    editing = i;
    const f = i === -1 ? { name: '', anyOf: [], except: [], schedule: [] } : filters[i];
    const ed = $('filter-editor');
    ed.hidden = false;
    ed.innerHTML = '<label>Name</label><input type="text" class="fname" maxlength="30">' +
      '<label>Any of</label><div class="any"></div><input type="text" class="anymore" placeholder="other tags, with commas">' +
      '<label>Except</label><div class="except"></div><label>Days and times</label><div class="entries"></div>';
    ed.querySelector('.fname').value = f.name;
    ed.querySelector('.any').appendChild(ticks(f.anyOf));
    ed.querySelector('.except').appendChild(ticks(f.except || []));
    for (const e of f.schedule || []) ed.querySelector('.entries').appendChild(entryForm(e));
    ed.appendChild(button('Add days and times', () => ed.querySelector('.entries').appendChild(entryForm({}))));
    ed.appendChild(button('Done', () => {
      const next = readEditor(ed);
      filters = editing === -1 ? filters.concat([next]) : filters.map((x, j) => (j === editing ? next : x));
      changed();
    }));
    ed.appendChild(button('Cancel', () => { editing = -1; ed.hidden = true; }));
    ed.scrollIntoView({ block: 'nearest' });
  }

  // The GitHub filters, shown as they are: they're changed in GitHub.
  function drawGithubFilters(list) {
    const box = $('githubfilters');
    box.textContent = list.length ? '' : 'None.';
    for (const f of list) {
      const row = document.createElement('div');
      row.className = 'filterrow';
      row.innerHTML = '<div class="top"><span class="name"></span></div><div class="what"></div>';
      row.querySelector('.name').textContent = f.name;
      row.querySelector('.what').textContent = describe(f);
      box.appendChild(row);
    }
  }

  async function loadFilters() {
    try {
      const d = await (await fetch('/api/filters')).json();
      filters = d.custom;
      drawFilters();
      drawGithubFilters(d.github);
    } catch (e) { /* the status line already says the box can't be reached */ }
  }

  $('filter-new').onclick = () => openEditor(-1);
  $('filter-save').onclick = async () => {
    noteFilters('Saving…');
    try {
      const r = await fetch('/api/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      });
      const d = await r.json();
      noteFilters(r.ok ? '✓ ' + d.message : d.error, !r.ok);
      if (r.ok) { loadFilters(); load(); }
    } catch (e) { noteFilters("Couldn't reach the box.", true); }
  };

  $('black').onclick = () => show('black');
  $('schedule').onclick = () => post('/api/schedule');
  // The answer shows under the button, where it was tapped.
  $('sync').onclick = async () => {
    const r = await post('/api/sync', {}, true);
    setText($('sync-note'), r.ok ? r.message : r.error);
    $('sync-note').className = 'note' + (r.ok ? '' : ' error');
  };
  load().catch(() => say("Couldn't reach the box.", true));
  loadItems();
  loadFilters();
  refresh();
  setInterval(refresh, 3000);
</script>
<script>
  // Adding a batch of files: the box checks the whole batch first, then each
  // file is sent in turn. Stops at the first refusal. No page code here, so
  // it can be tried on its own.
  async function sendBatch(files, api, ui) {
    const checked = await api.check(files);
    if (!checked.ok) {
      ui.say(checked.error, true);
      return false;
    }
    for (const file of files) {
      ui.progress(file.name, 'Sending…');
      const r = await api.upload(file, (percent) => ui.progress(file.name, 'Sending… ' + percent + '%'));
      ui.progress(file.name, r.ok ? r.message : r.error);
      if (!r.ok) {
        ui.say(r.error, true);
        return false;
      }
    }
    ui.say(files.length === 1 ? 'Added 1 file.' : 'Added ' + files.length + ' files.');
    return true;
  }

  // What is playing, from the status line, as Play's choices: '#tag' for
  // each tag picked, the name of each filter (picked, or on its schedule),
  // or 'black'. '#favorites + Halloween kid (override until cleared)' ->
  // ['#favorites', 'Halloween kid']. Filter names can't contain '(' or '+'.
  function playingChoices(status, filters) {
    const key = String(status || '').split(' (')[0];
    if (key === 'black') return ['black'];
    if (!key || key === 'null') return [];
    return key.split(' + ').filter((p) => p.startsWith('#') || filters.includes(p));
  }

  // A tag as words: 'halloween-grownup' -> 'Halloween grownup', 'upload' -> 'Uploads'.
  function tagLabel(tag) {
    if (tag === 'upload') return 'Uploads';
    const words = tag.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  // The list with item i moved by step (-1 up, 1 down), staying in bounds.
  function moveFilter(list, i, step) {
    const j = i + step;
    if (j < 0 || j >= list.length) return list.slice();
    const out = list.slice();
    const moved = out.splice(i, 1)[0];
    out.splice(j, 0, moved);
    return out;
  }
</script>
</body>
</html>
`;

// The easy page, at /: for someone who scanned the code on the TV and wants
// to put a few of their own pictures on it. Their name becomes a tag on
// everything they add, and that tag then plays until someone changes it.
const EASY_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tvBox</title>
<style>
  :root { color-scheme: dark; --bg: #121212; --card: #1e1e1e; --text: #f2f2f2; --dim: #a0a0a0; --accent: #ff8a1f; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 18px/1.4 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
  main { max-width: 480px; margin: 0 auto; padding: 24px 16px 40px; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .lead { color: var(--dim); margin: 0 0 20px; }
  .card { background: var(--card); border-radius: 14px; padding: 16px; }
  label { display: block; font-size: 15px; color: var(--dim); margin: 14px 0 6px; }
  label:first-child { margin-top: 0; }
  input[type=text], input[type=password] { font: inherit; color: var(--text); background: #2c2c2c; border: 1px solid #3a3a3a; border-radius: 10px; padding: 14px; width: 100%; }
  .hint { font-size: 14px; color: var(--dim); margin-top: 6px; }
  .pick { display: block; position: relative; text-align: center; background: #2c2c2c; border: 1px dashed #5a5a5a; border-radius: 10px; padding: 16px; cursor: pointer; }
  .pick input { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
  #chosen { font-size: 15px; color: var(--dim); margin-top: 6px; }
  button { font: inherit; font-weight: 600; width: 100%; margin-top: 20px; padding: 16px; border-radius: 12px; border: none; background: var(--accent); color: #1a1a1a; cursor: pointer; }
  button:disabled { opacity: .45; cursor: default; }
  #message { min-height: 1.4em; margin-top: 14px; color: var(--accent); font-weight: 600; }
  #message.error { color: #ff6b6b; }
  #progress { font-size: 14px; color: var(--dim); margin-top: 8px; }
  .other { display: block; text-align: center; margin-top: 28px; color: var(--dim); font-size: 15px; }
  #thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
  #thumbs:empty { display: none; }
  .thumb { position: relative; aspect-ratio: 1; background: #000; border-radius: 8px; overflow: hidden; }
  .thumb img, .thumb video { width: 100%; height: 100%; object-fit: contain; display: block; }
  .thumb .shape { position: absolute; left: 4px; bottom: 4px; padding: 1px 6px; font-size: 12px; border-radius: 4px; color: #fff; background: rgba(0, 0, 0, 0.7); }
  .thumb .shape:empty { display: none; }
  .thumb.off .shape { background: #b3261e; }
  #fit { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #3a2a10; color: #ffd28a; font-size: 15px; }
  #fit:empty { display: none; }
</style>
</head>
<body>
<main>
  <h1>Put your pictures on the TV</h1>
  <p class="lead">Add your photos or videos and they'll play on the TV.</p>
  <div class="card">
    <label for="name">Your name</label>
    <input id="name" type="text" autocomplete="name" maxlength="60" placeholder="Aunt Sue">
    <label>Photos and videos</label>
    <label class="pick">Choose photos or videos<input id="files" type="file" accept="image/*,video/*" multiple></label>
    <div id="chosen"></div>
    <div id="thumbs"></div>
    <div id="fit" role="status" aria-live="polite"></div>
    <button id="send">Put them on the TV</button>
    <div id="message"></div>
    <div id="progress"></div>
  </div>
  <a class="other" href="/advanced">Advanced</a>
</main>
<script>
  const $ = (id) => document.getElementById(id);
  try { localStorage.removeItem('tvbox-upload-pin'); } catch (e) { /* no longer needed */ }
  try { $('name').value = localStorage.getItem('tvbox-visitor-name') || ''; } catch (e) { /* type it */ }

  function say(text, error) {
    $('message').textContent = text;
    $('message').className = error ? 'error' : '';
  }

  // The way the TV faces now, read when the page opens and when files are picked.
  let tvWay = 'portrait';
  async function readTvWay() {
    try { tvWay = (await (await fetch('/api/screen')).json()).orientation || tvWay; } catch (e) { /* keep the last */ }
  }
  readTvWay();

  // Each picked file as a thumbnail labeled with its shape, measured as the
  // box does once the phone has loaded it; then the warning if none fit.
  let shapes = [];
  let picked = 0;
  const LABELS = { portrait: 'Portrait', landscape: 'Landscape', square: 'Square' };
  function showFit() {
    $('fit').textContent = fitNote(shapes, tvWay);
    for (const box of $('thumbs').children) {
      const shape = box.dataset.shape;
      box.classList.toggle('off', Boolean(shape) && shape !== 'square' && shape !== tvWay);
    }
  }
  $('files').onchange = async () => {
    const files = Array.from($('files').files);
    const n = files.length;
    $('chosen').textContent = n ? (n === 1 ? '1 file chosen' : n + ' files chosen') : '';
    $('thumbs').textContent = '';
    $('fit').textContent = '';
    const batch = ++picked;
    shapes = files.map(() => null);
    await readTvWay();
    files.forEach((file, i) => {
      const box = document.createElement('div');
      box.className = 'thumb';
      const label = document.createElement('span');
      label.className = 'shape';
      const isVideo = String(file.type).startsWith('video/') || /[.](mp4|mov|m4v)$/i.test(file.name);
      const media = document.createElement(isVideo ? 'video' : 'img');
      const done = (w, h) => {
        if (batch !== picked) return;
        const shape = shapeOf(w, h);
        shapes[i] = shape;
        box.dataset.shape = shape || '';
        label.textContent = shape ? LABELS[shape] : '';
        showFit();
      };
      if (isVideo) {
        media.muted = true;
        media.playsInline = true;
        media.preload = 'metadata';
        media.onloadedmetadata = () => done(media.videoWidth, media.videoHeight);
      } else {
        media.onload = () => done(media.naturalWidth, media.naturalHeight);
      }
      media.onerror = () => done(0, 0);
      media.src = URL.createObjectURL(file);
      box.appendChild(media);
      box.appendChild(label);
      $('thumbs').appendChild(box);
    });
  };

  async function postJson(path, body) {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      return { ok: r.ok, message: d.message, error: d.error, tag: d.tag };
    } catch (e) { return { ok: false, error: "Couldn't reach the box." }; }
  }

  const api = {
    check: (files, name) => postJson('/api/uploads/check',
      { name, files: files.map((f) => ({ name: f.name, bytes: f.size })) }),
    upload(file, tag, onProgress) {
      return new Promise((resolve) => {
        const x = new XMLHttpRequest();
        x.open('POST', '/api/uploads?name=' + encodeURIComponent(file.name) + '&tag=' + encodeURIComponent(tag));
        x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total)); };
        x.onload = () => {
          let d = {};
          try { d = JSON.parse(x.responseText); } catch (e) { /* no answer */ }
          resolve({ ok: x.status === 200, message: d.message, saved: d.saved, error: d.error || 'The box refused it.' });
        };
        x.onerror = () => resolve({ ok: false, error: 'The upload stopped. Keep this page open while it sends, then try again.' });
        x.send(file);
      });
    },
    // Keeps just these under the tag (earlier visits' pictures go), then plays it until cleared.
    play: (tag, keep) => postJson('/api/visitor/play', { tag, keep }),
  };

  const rows = {};
  const ui = {
    say,
    remember(name) {
      try { localStorage.setItem('tvbox-visitor-name', name); } catch (e) { /* not kept */ }
    },
    progress(name, text) {
      if (!rows[name]) {
        rows[name] = document.createElement('div');
        $('progress').appendChild(rows[name]);
      }
      rows[name].textContent = name + ': ' + text;
    },
  };

  $('send').onclick = async () => {
    $('send').disabled = true;
    $('progress').textContent = '';
    for (const k of Object.keys(rows)) delete rows[k];
    const form = { name: $('name').value, files: Array.from($('files').files), note: fitNote(shapes, tvWay) };
    const done = await sendVisit(form, api, ui);
    if (done) {
      $('files').value = '';
      $('chosen').textContent = '';
      $('thumbs').textContent = '';
      $('fit').textContent = '';
      shapes = [];
    }
    $('send').disabled = false;
  };
</script>
<script>
  // Put them on the TV: a name and files are needed; the box checks the
  // name and the whole batch, each file is sent with the visitor's tag, and
  // only when all were added does the box keep just these under the tag
  // (deleting an earlier visit's) and play it, until changed. Stops at the
  // first refusal. No page code here, so it can be tried on its own.
  // A picture's shape by the box's rule: wider than tall is landscape,
  // exactly as wide as tall is square; null when it couldn't be measured.
  function shapeOf(width, height) {
    if (!(width > 0) || !(height > 0)) return null;
    return width === height ? 'square' : width > height ? 'landscape' : 'portrait';
  }

  // The warning when every measured picture is the other shape from the TV's
  // way (orientation); '' when any fits, is square, or none are measured.
  function fitNote(shapes, orientation) {
    const known = shapes.filter(Boolean);
    const other = orientation === 'portrait' ? 'landscape' : 'portrait';
    if (!known.length || !known.every((s) => s === other)) return '';
    return 'The TV is ' + orientation + ', so ' + other + " pictures won't show until it's turned.";
  }

  async function sendVisit(form, api, ui) {
    const name = String(form.name || '').trim();
    const files = form.files || [];
    if (!name) { ui.say('Type your name first.', true); return false; }
    if (!files.length) { ui.say('Choose some photos or videos first.', true); return false; }
    const checked = await api.check(files, name);
    if (!checked.ok) {
      ui.say(checked.error, true);
      return false;
    }
    ui.remember(name);
    const saved = [];
    for (const file of files) {
      ui.progress(file.name, 'Sending…');
      const r = await api.upload(file, checked.tag, (percent) => ui.progress(file.name, 'Sending… ' + percent + '%'));
      ui.progress(file.name, r.ok ? 'Added.' : r.error);
      if (!r.ok) {
        ui.say(r.error, true);
        return false;
      }
      saved.push(r.saved);
    }
    const shown = await api.play(checked.tag, saved);
    if (!shown.ok) { ui.say(shown.error, true); return false; }
    const way = form.note ? /^The TV is ([a-z]+)/.exec(form.note)[1] : null;
    ui.say(way ? "Done! They're on the box, but the TV is " + way + ", so they won't show until it's turned."
      : 'Done! Your pictures are on the TV now.');
    return true;
  }
</script>
</body>
</html>
`;

module.exports = { createWebsite, startWebsite };
