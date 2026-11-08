// Tests for the scheduler's logic (scheduler/logic.js), run with Node:
//   node scheduler/tests/scheduler.test.js
// Files, folders and mpv are replaced with fakes.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createScheduler } = require('../logic.js');
const config = require('../config.js');
const { FakeMpv } = require('./fake_mpv.js');

const ROOT = '/home/test/video-scheduler';
const STARTING = fs.readFileSync(path.join(__dirname, '..', '..', 'playlists', 'filters.json'), 'utf8');

// Loads the scheduler with fakes. `files` maps paths (relative to the video
// folder) to contents; `dirs` maps folders (relative) to the names in them.
// Top folders are added to the video folder's own listing.
function load({ files = {}, dirs = {}, filters, github, tags } = {}) {
  const logs = [];
  const fileMap = {};
  for (const [k, v] of Object.entries(files)) fileMap[ROOT + '/' + k] = v;
  if (filters !== undefined) fileMap[ROOT + '/filters.json'] = JSON.stringify({ filters });
  if (github !== undefined) fileMap[ROOT + '/github-filters.json'] = JSON.stringify({ filters: github });
  if (tags !== undefined) fileMap[ROOT + '/tags.json'] = JSON.stringify({ tags });
  const folders = { [ROOT]: [] };
  for (const [k, v] of Object.entries(dirs)) {
    folders[ROOT + '/' + k] = v.slice();
    const parts = k.split('/');
    for (let i = 0; i < parts.length; i++) {
      const parent = [ROOT].concat(parts.slice(0, i)).join('/');
      folders[parent] = folders[parent] || [];
      if (!folders[parent].includes(parts[i])) folders[parent].push(parts[i]);
    }
  }
  const T = createScheduler({
    config,
    videoRoot: ROOT,
    readText: (p) => (p in fileMap ? fileMap[p] : null),
    writeText: (p, text) => { fileMap[p] = text; },
    removeFile: (p) => { delete fileMap[p]; },
    listFolder: (p) => (p in folders ? folders[p].slice() : null),
    log: (m) => logs.push(m),
  });
  return { T, logs, files: fileMap, folders };
}

const at = (month, day, h = 12, m = 0, year = 2026) => new Date(year, month - 1, day, h, m);
let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const fresh = () => ({ warnedText: null });
// A filter has to have days and times; this one is on all year.
const ALWAYS = [{ from: '01-01', to: '12-31' }];
const starting = () => JSON.parse(STARTING).filters;
const fn = (t, name) => {
  assert.equal(typeof t[name], 'function', 'the scheduler has ' + name);
  return t[name];
};
const rels = (items) => items.map((i) => i.path);

// Plays `n` items of the filter called `name` and returns them, relative.
async function play(t, name, n) {
  const p = t.createPlaylist(name);
  const mpv = new FakeMpv();
  const played = [];
  for (let i = 0; i < n; i++) {
    await t.keepPlaying(p, mpv);
    played.push(mpv.playing() && mpv.playing().replace(ROOT + '/', ''));
    if (mpv.playing()) mpv.finish();
  }
  return played;
}

// ---- tags: folders, uploads ----

test("a video's tag is its folder path joined with dashes", () => {
  const { T: t } = load({ dirs: {
    halloween: ['fuzzy.mp4'], 'halloween/kid': ['x.mp4'], 'halloween/grownup': ['y.mp4'], 'Easter Eggs': ['z.mp4'],
  } });
  const items = fn(t, 'items')();
  const tag = (p) => items.find((i) => i.path === p).folderTags;
  assert.deepEqual(tag('halloween/fuzzy.mp4'), ['halloween']);
  assert.deepEqual(tag('halloween/kid/x.mp4'), ['halloween-kid']);
  assert.deepEqual(tag('halloween/grownup/y.mp4'), ['halloween-grownup']);
  assert.deepEqual(tag('Easter Eggs/z.mp4'), ['easter-eggs']);
});

test('a photo in a repo folder is not an item', () => {
  const { T: t } = load({ dirs: { halloween: ['fuzzy.mp4', 'poster.jpg'] } });
  assert.deepEqual(rels(fn(t, 'items')()), ['halloween/fuzzy.mp4']);
});

test('a folder whose name makes no tag is left out and logged once', () => {
  const long = 'a'.repeat(40);
  const { T: t, logs } = load({ dirs: {
    'halloween/kid': ['a.mp4'], 'halloween-kid': ['b.mp4'], '!!!': ['c.mp4'], [long]: ['d.mp4'],
  } });
  fn(t, 'items')();
  const items = t.items();
  assert.deepEqual(items.map((i) => i.path).sort(), ['halloween-kid/b.mp4', 'halloween/kid/a.mp4']);
  assert.ok(items.every((i) => i.folderTags[0] === 'halloween-kid'));
  const msg = "Leaving out !!!: its name doesn't make a tag (at most 30 letters, digits and dashes).";
  assert.equal(logs.filter((l) => l === msg).length, 1, logs.join('\n'));
  assert.equal(logs.filter((l) => l.startsWith('Leaving out ' + long + ':')).length, 1, logs.join('\n'));
});

test('an upload is tagged upload', () => {
  const { T: t } = load({ dirs: { photos: ['00001-a.jpg', '00002-b.mov', '.upload-1'] } });
  const items = fn(t, 'items')();
  assert.deepEqual(rels(items), ['photos/00001-a.jpg', 'photos/00002-b.mov']);
  assert.ok(items.every((i) => i.folderTags.join() === 'upload'));
});

// ---- filters: what a filter shows ----

test('a filter plays the items with any of its tags', async () => {
  const { T: t } = load({
    dirs: { halloween: ['fuzzy.mp4'], 'halloween/kid': ['x.mp4'], 'halloween/grownup': ['y.mp4'], thanksgiving: ['dusk.mp4'] },
    filters: [{ name: 'Halloween kid', anyOf: ['halloween', 'halloween-kid'], schedule: ALWAYS }],
  });
  fn(t, 'readFilters');
  assert.deepEqual(await play(t, 'Halloween kid', 4),
    ['halloween/fuzzy.mp4', 'halloween/kid/x.mp4', 'halloween/fuzzy.mp4', 'halloween/kid/x.mp4']);
});

test('a filter leaves out items with an except tag', async () => {
  const { T: t } = load({
    dirs: { christmas: ['tree.mp4'], photos: ['00001-a.jpg', '00002-b.jpg'] },
    tags: { 'photos/00001-a.jpg': ['family'], 'photos/00002-b.jpg': ['family', 'scary'] },
    filters: [{ name: 'Christmas', anyOf: ['christmas', 'family'], except: ['scary'], schedule: ALWAYS }],
  });
  fn(t, 'readFilters');
  assert.deepEqual(await play(t, 'Christmas', 3), ['photos/00001-a.jpg', 'christmas/tree.mp4', 'photos/00001-a.jpg']);
});

test('a box tag puts an upload in a filter', async () => {
  const { T: t } = load({
    dirs: { halloween: ['fuzzy.mp4'], photos: ['00001-a.jpg', '00002-b.jpg', '00003-c.jpg'] },
    tags: { 'photos/00001-a.jpg': ['favorites'], 'photos/00003-c.jpg': ['favorites'], 'halloween/fuzzy.mp4': ['favorites'] },
    filters: [{ name: 'Family', anyOf: ['favorites'], schedule: ALWAYS }],
  });
  fn(t, 'readFilters');
  assert.deepEqual(await play(t, 'Family', 3), ['photos/00001-a.jpg', 'photos/00003-c.jpg', 'photos/00001-a.jpg']);
});

test('a filter plays its items in name order, round and round', async () => {
  const { T: t } = load({
    dirs: { halloween: ['2-b.mp4', 'a.mp4'], 'halloween/kid': ['10-c.mp4'], photos: ['00001-x.jpg'] },
    tags: { 'photos/00001-x.jpg': ['halloween'] },
    filters: [{ name: 'Halloween kid', anyOf: ['halloween', 'halloween-kid'], schedule: ALWAYS }],
  });
  fn(t, 'readFilters');
  const four = ['photos/00001-x.jpg', 'halloween/2-b.mp4', 'halloween/kid/10-c.mp4', 'halloween/a.mp4'];
  assert.deepEqual(await play(t, 'Halloween kid', 8), four.concat(four));
});

test('a filter with nothing in it shows black and says so once', async () => {
  const { T: t, logs } = load({ dirs: { thanksgiving: ['dusk.mp4'] }, filters: [{ name: 'Halloween kid', anyOf: ['halloween', 'halloween-kid'], schedule: ALWAYS }] });
  fn(t, 'readFilters');
  const p = t.createPlaylist('Halloween kid');
  const mpv = new FakeMpv();
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(mpv.playing(), null);
  const msg = 'Nothing in Halloween kid yet (any of halloween, halloween-kid). Showing black until something is tagged.';
  assert.equal(logs.filter((l) => l === msg).length, 1, logs.join('\n'));
  assert.ok(!logs.some((l) => /ERROR/.test(l)), logs.join('\n'));
});

test('a bad filter in the filters file is skipped and logged', () => {
  const { T: t, logs } = load({ filters: [{ name: 'Empty', anyOf: [], schedule: ALWAYS }, { name: 'Christmas', anyOf: ['christmas'], schedule: ALWAYS }] });
  fn(t, 'readFilters')();
  const kept = t.readFilters();
  assert.deepEqual(kept.map((f) => f.name), ['Christmas']);
  const errors = logs.filter((l) => l.startsWith('ERROR: Ignoring filter 1'));
  assert.equal(errors.length, 1, logs.join('\n'));
  assert.ok(errors[0].includes('no "any of" tags'), errors[0]);
});

test('no filters file means no filters', () => {
  const { T: t, logs } = load();
  fn(t, 'readFilters')();
  assert.deepEqual(t.readFilters(), []);
  const msg = 'No filters on this box yet, so nothing is scheduled. Add one on the website.';
  assert.equal(logs.filter((l) => l === msg).length, 1, logs.join('\n'));
});

test("the GitHub filters are today's seasons", () => {
  const { T: t, logs } = load({ files: { 'github-filters.json': STARTING } });
  const f = fn(t, 'readFilters')();
  assert.ok(f.every((x) => x.source === 'github'), 'they come from GitHub');
  assert.ok(!logs.some((l) => /ERROR/.test(l)), logs.join('\n'));
  assert.deepEqual(f.map((x) => x.name), ['Halloween kid', 'Halloween grownup', 'Thanksgiving']);
  const raw = starting();
  assert.deepEqual(raw.map((x) => x.anyOf), [['halloween', 'halloween-kid'], ['halloween', 'halloween-grownup'], ['thanksgiving']]);
  const times = (x) => (x.schedule || []).map((e) => [e.from, e.to, (e.weekdays || []).join('/'), (e.also || []).join('/'),
    (e.times || []).map((w) => w.start + '-' + w.stop).join(',')].join(' '));
  assert.deepEqual(times(raw[0]), ['10-01 10-31   05:00-07:00,17:00-19:30']);
  assert.deepEqual(times(raw[1]), ['10-01 10-31   19:30-23:00']);
  assert.deepEqual(times(raw[2]), ['11-01 11-4thu fri/sat 11-4thu-1/11-4thu 17:00-23:00']);
});

// ---- filter-schedule ----

function startingBox(extra = {}) {
  return load(Object.assign({ files: { 'github-filters.json': STARTING } }, extra));
}
const show = (t, date, overrideState = fresh()) => fn(t, 'whatToShow')(t.readFilters(), date, overrideState);
const scheduled = (t, filters, date) => {
  const f = fn(t, 'scheduledFilter')(filters, date);
  return f ? f.name : null;
};

test('a scheduled filter plays on its days and times', () => {
  const { T: t } = startingBox();
  const r = show(t, at(10, 20, 18));
  assert.equal(r.filter, 'Halloween kid');
  assert.equal(r.status, 'Halloween kid (scheduled until 7:30 PM)');
});

test('the next filter takes over when its time starts', () => {
  const { T: t } = startingBox();
  assert.equal(show(t, at(10, 20, 19, 29)).filter, 'Halloween kid');
  const r = show(t, at(10, 20, 19, 30));
  assert.equal(r.filter, 'Halloween grownup');
  assert.equal(r.status, 'Halloween grownup (scheduled until 11:00 PM)');
});

test('outside every entry the screen is black', () => {
  const { T: t } = startingBox();
  const late = show(t, at(10, 20, 23, 30));
  assert.equal(late.filter, null);
  assert.equal(late.status, 'black (nothing scheduled until Wed 5:00 AM)');
  const jan = show(t, at(1, 15, 18));
  assert.equal(jan.filter, null);
  assert.equal(jan.status, 'black (nothing scheduled)');
});

test('schedule days are inclusive and can wrap the new year', () => {
  const { T: t } = load();
  const filters = fn(t, 'checkFilters')([
    { name: 'October', anyOf: ['halloween'], schedule: [{ from: '10-01', to: '10-31' }] },
    { name: 'Winter', anyOf: ['winter'], schedule: [{ from: '12-15', to: '01-06' }] },
  ]).filters;
  assert.equal(scheduled(t, filters, at(9, 30)), null);
  assert.equal(scheduled(t, filters, at(10, 1, 0, 0)), 'October');
  assert.equal(scheduled(t, filters, at(10, 31, 23, 59)), 'October');
  assert.equal(scheduled(t, filters, at(12, 14)), null);
  assert.equal(scheduled(t, filters, at(12, 15)), 'Winter');
  assert.equal(scheduled(t, filters, at(1, 6)), 'Winter');
  assert.equal(scheduled(t, filters, at(1, 7)), null);
});

test('days written as the nth or last weekday of a month, with offsets', () => {
  const { T: t } = load();
  const day = (text, year, withYear = false) => {
    const d = fn(t, 'parseDay')(text, withYear)(year);
    return d && [d.year, d.month, d.day].join('-');
  };
  assert.equal(day('11-4thu', 2026), '2026-11-26');
  assert.equal(day('11-4thu-1', 2026), '2026-11-25');
  assert.equal(day('11-4thu+1', 2026), '2026-11-27');
  assert.equal(day('05-lastmon', 2026), '2026-5-25');
  assert.equal(day('09-1mon', 2026), '2026-9-7');
  assert.equal(day('11-5thu', 2026), null);
  assert.equal(day('02-29', 2026), null);
  assert.equal(day('02-29', 2028), '2028-2-29');
  assert.equal(day('01-01-1', 2026), '2025-12-31');
  assert.equal(day('2026-11-14', 2026, true), '2026-11-14');
  assert.equal(day('2026-11-14', 2027, true), null);
  for (const bad of ['11-4xyz', '11-6thu', '13-01', '11-31', '11-04thu', 'thanksgiving', '']) {
    assert.equal(t.parseDay(bad, true), null, bad);
  }
  // A day with a year is only for extra days, never a first or last day.
  assert.equal(t.checkFilters([{ name: 'X', anyOf: ['x'], schedule: [{ from: '2026-11-14', to: '12-01' }] }]).filters.length, 0);
  assert.equal(t.checkFilters([{ name: 'X', anyOf: ['x'], schedule: [{ also: ['2026-11-14'] }] }]).filters.length, 1);
});

test('weekdays within the range, and extra days outside it or with a year', () => {
  const { T: t } = load();
  const filters = fn(t, 'checkFilters')([{ name: 'Weekends', anyOf: ['x'],
    schedule: [{ from: '06-01', to: '06-30', weekdays: ['Saturday', 'sun'], also: ['07-04', '2026-08-15'] }] }]).filters;
  assert.equal(scheduled(t, filters, at(6, 6)), 'Weekends'); // Sat
  assert.equal(scheduled(t, filters, at(6, 7)), 'Weekends'); // Sun
  assert.equal(scheduled(t, filters, at(6, 8)), null); // Mon
  assert.equal(scheduled(t, filters, at(7, 4)), 'Weekends');
  assert.equal(scheduled(t, filters, at(8, 15)), 'Weekends');
  assert.equal(scheduled(t, filters, at(8, 15, 12, 0, 2027)), null);
});

test('Thanksgiving: Fridays and Saturdays until Thanksgiving, then the day before and the day', () => {
  const { T: t } = startingBox();
  const filters = fn(t, 'readFilters')();
  const days = (year) => {
    const out = [];
    for (let d = 1; d <= 30; d++) if (scheduled(t, filters, new Date(year, 10, d, 20)) === 'Thanksgiving') out.push(d);
    return out;
  };
  assert.deepEqual(days(2026), [6, 7, 13, 14, 20, 21, 25, 26]);
  assert.deepEqual(days(2027), [5, 6, 12, 13, 19, 20, 24, 25]);
  assert.deepEqual(days(2025), [1, 7, 8, 14, 15, 21, 22, 26, 27]);
});

test('a time that crosses midnight belongs to the day it starts', () => {
  const { T: t, files } = load();
  files[ROOT + '/filters.json'] = JSON.stringify({ filters: [{ name: 'Late', anyOf: ['x'],
    schedule: [{ from: '01-01', to: '12-31', weekdays: ['fri'], times: [{ start: '22:00', stop: '01:00' }] }] }] });
  fn(t, 'readFilters');
  const fri = show(t, at(10, 23, 23));
  assert.equal(fri.filter, 'Late');
  assert.equal(fri.status, 'Late (scheduled until Sat 1:00 AM)');
  assert.equal(show(t, at(10, 24, 0, 30)).filter, 'Late');
  assert.equal(show(t, at(10, 24, 23)).filter, null);
});

test("where two filters' entries overlap, the higher one plays", () => {
  const { T: t } = load();
  const evening = [{ start: '17:00', stop: '23:00' }];
  const filters = fn(t, 'checkFilters')([
    { name: 'Christmas', anyOf: ['christmas'], schedule: [{ from: '12-01', to: '12-31', times: evening }] },
    { name: 'Winter', anyOf: ['winter'], schedule: [{ from: '12-15', to: '01-06', times: evening }] },
  ]).filters;
  assert.equal(scheduled(t, filters, at(12, 10, 18)), 'Christmas');
  assert.equal(scheduled(t, filters, at(12, 20, 18)), 'Christmas');
  assert.equal(scheduled(t, filters, at(1, 6, 18)), 'Winter');
});

// ---- overrides ----

function withOverride(o, date, extra = {}) {
  const box = startingBox();
  box.files[box.T.OVERRIDE_PATH] = JSON.stringify(Object.assign({ setAt: +at(10, 20, 17), expires: null, untilCleared: false }, o));
  Object.assign(box.files, extra);
  return Object.assign(box, { r: show(box.T, date) });
}

test('an override "until the schedule changes" ends at the next period', () => {
  assert.equal(withOverride({ tags: null }, at(10, 20, 19, 29)).r.status,
    'black (override until the schedule changes at 7:30 PM)');
  assert.equal(withOverride({ tags: null }, at(10, 20, 19, 30)).r.filter, 'Halloween grownup');
});

test('an override plays the chosen tags whatever the schedule', async () => {
  const { T: t, files } = startingBox({ dirs: { halloween: ['fuzzy.mp4'], thanksgiving: ['dusk.mp4'], christmas: ['tree.mp4'] } });
  files[t.OVERRIDE_PATH] = JSON.stringify({ tags: ['halloween', 'thanksgiving'], setAt: +at(1, 15, 17), expires: null, untilCleared: true });
  const r = show(t, at(1, 15, 18));
  assert.equal(r.status, '#halloween + #thanksgiving (override until cleared)');
  assert.deepEqual(await play(t, r.filter, 4), ['thanksgiving/dusk.mp4', 'halloween/fuzzy.mp4', 'thanksgiving/dusk.mp4', 'halloween/fuzzy.mp4']);
});

test('an override plays chosen tags and filters together', async () => {
  const { T: t, files } = startingBox({ dirs: { halloween: ['fuzzy.mp4'], 'halloween/grownup': ['jump.mp4'], photos: ['00001-a.jpg'] },
    tags: { 'photos/00001-a.jpg': ['favorites'] } });
  files[t.OVERRIDE_PATH] = JSON.stringify({ tags: ['favorites'], filters: ['Halloween kid'], setAt: +at(1, 15, 17), expires: null, untilCleared: true });
  const r = show(t, at(1, 15, 18));
  assert.equal(r.status, '#favorites + Halloween kid (override until cleared)');
  assert.deepEqual(await play(t, r.filter, 3), ['photos/00001-a.jpg', 'halloween/fuzzy.mp4', 'photos/00001-a.jpg']);
});

test('chosen tags with nothing in them show black and say so once', async () => {
  const { T: t, logs, files } = startingBox({ dirs: { halloween: ['fuzzy.mp4'] } });
  files[t.OVERRIDE_PATH] = JSON.stringify({ tags: ['easter'], setAt: +at(1, 15, 17), expires: null, untilCleared: true });
  const r = show(t, at(1, 15, 18));
  const p = t.createPlaylist(r.filter);
  const mpv = new FakeMpv();
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(mpv.playing(), null);
  const msg = 'Nothing tagged easter yet. Showing black until something is.';
  assert.equal(logs.filter((l) => l === msg).length, 1, logs.join('\n'));
  assert.ok(!logs.some((l) => /ERROR/.test(l)), logs.join('\n'));
});

test("an override naming a filter that's gone is ended and logged", () => {
  const box = withOverride({ tags: [], filters: ['Easter'], untilCleared: true }, at(10, 20, 18));
  assert.equal(box.r.filter, 'Halloween kid');
  assert.ok(!(box.T.OVERRIDE_PATH in box.files), 'the override file is gone');
  assert.ok(box.logs.includes('Ending the override: there is no filter called Easter any more.'), box.logs.join('\n'));
});

test('an override from before tags is ended and logged', () => {
  for (const [old, name] of [[{ filter: 'Thanksgiving' }, 'Thanksgiving'], [{ playlist: 'halloween/grownup' }, 'halloween/grownup']]) {
    const box = startingBox();
    box.files[box.T.OVERRIDE_PATH] = JSON.stringify(Object.assign({ setAt: +at(10, 20, 17), expires: null, untilCleared: true }, old));
    const r = show(box.T, at(10, 20, 18));
    assert.equal(r.filter, 'Halloween kid');
    assert.ok(!(box.T.OVERRIDE_PATH in box.files));
    assert.ok(box.logs.includes('Ending an override from before tags could be played (' + name + ').'), box.logs.join('\n'));
  }
});

test('override file validation for tags', () => {
  const { T: t } = load();
  const ok = (o) => t.parseOverride(JSON.stringify(Object.assign({ setAt: 1 }, o))).ok;
  assert.ok(ok({ tags: ['halloween', 'halloween-kid'] }) && ok({ tags: [], filters: ['Halloween kid'] }) && ok({ tags: null }));
  assert.ok(!ok({ tags: [] }) && !ok({ tags: ['Fav Orites'] }) && !ok({ tags: 'halloween' }) && !ok({ tags: [7] }) &&
    !ok({ tags: [], filters: ['Kid (old)'] }));
});

// ---- More schedule cases (from the implementation review) ----

test('an extra day with an offset into the year before still counts', () => {
  const { T: t } = load();
  const filters = t.checkFilters([{ name: 'Eve', anyOf: ['x'], schedule: [{ also: ['01-01-1'] }] }]).filters;
  assert.equal(scheduled(t, filters, at(12, 31, 12, 0, 2026)), 'Eve');
  assert.equal(scheduled(t, filters, at(12, 30, 12, 0, 2026)), null);
});

test("a range ending on a day that moves with the year never wraps the year", () => {
  const { T: t } = load();
  // 11-4thu is Nov 26 in 2026, after Nov 25: still not a range across the new year.
  const filters = t.checkFilters([{ name: 'Late Nov', anyOf: ['x'], schedule: [{ from: '11-4thu', to: '11-25' }] }]).filters;
  assert.equal(scheduled(t, filters, at(6, 1, 12, 0, 2026)), null);
  assert.equal(scheduled(t, filters, at(11, 25, 12, 0, 2027)), 'Late Nov'); // Thanksgiving 2027 is Nov 25
});

test('an override until the schedule changes lasts until the next change, even months away', () => {
  const box = startingBox();
  box.files[box.T.OVERRIDE_PATH] = JSON.stringify({ tags: ['halloween'], setAt: +at(1, 15, 17), expires: null, untilCleared: false });
  box.files[ROOT + '/tags.json'] = JSON.stringify({ tags: {} });
  const jan = show(box.T, at(1, 15, 18));
  assert.equal(jan.filter, '#halloween');
  assert.ok(jan.status.startsWith('#halloween (override until the schedule changes at'), jan.status);
  assert.equal(show(box.T, at(10, 1, 5, 0)).filter, 'Halloween kid');
});

test('a window after midnight belongs to the day before, on the range edges', () => {
  const { T: t } = load();
  const filters = t.checkFilters([{ name: 'Oct nights', anyOf: ['x'],
    schedule: [{ from: '10-01', to: '10-31', times: [{ start: '22:00', stop: '01:00' }] }] }]).filters;
  assert.equal(scheduled(t, filters, at(11, 1, 0, 30)), 'Oct nights'); // belongs to Oct 31
  assert.equal(scheduled(t, filters, at(10, 1, 0, 30)), null); // belongs to Sept 30
  assert.equal(scheduled(t, filters, at(10, 1, 22, 30)), 'Oct nights');
});

test('a filter called off is refused, as it means Black', () => {
  const { T: t } = load();
  const r = t.checkFilters([{ name: 'Off', anyOf: ['x'] }]);
  assert.equal(r.filters.length, 0);
  assert.ok(r.errors[0].error.includes('kept for the Black button'), r.errors[0].error);
});

test('a bad entry in tags.json is skipped, not fatal', () => {
  const { T: t } = load({ dirs: { photos: ['00001-a.jpg', '00002-b.jpg'] },
    files: { 'tags.json': JSON.stringify({ tags: { 'photos/00001-a.jpg': null, 'photos/00002-b.jpg': ['favorites', 7] } }) } });
  const items = t.items();
  assert.deepEqual(items.find((i) => i.path === 'photos/00001-a.jpg').boxTags, []);
  assert.deepEqual(items.find((i) => i.path === 'photos/00002-b.jpg').boxTags, ['favorites']);
});

test("an override for a missing filter isn't ended while filters.json has mistakes", () => {
  const box = startingBox();
  const raw = JSON.parse(STARTING).filters;
  raw[2].anyOf = []; // Thanksgiving made bad by a hand edit
  box.files[ROOT + '/filters.json'] = JSON.stringify({ filters: raw });
  box.files[box.T.OVERRIDE_PATH] = JSON.stringify({ tags: [], filters: ['Thanksgiving'], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  show(box.T, at(10, 20, 18));
  assert.ok(box.T.OVERRIDE_PATH in box.files, 'the override is kept');
});

// ---- GitHub filters and custom filters ----

const party = { name: 'Party', anyOf: ['halloween'], schedule: [{ from: '10-01', to: '10-31', times: [{ start: '17:00', stop: '23:00' }] }] };

test('custom filters come before the GitHub filters', () => {
  const { T: t } = startingBox({ filters: [party] });
  const r = show(t, at(10, 20, 18));
  assert.equal(r.filter, 'Party');
  assert.equal(r.status, 'Party (scheduled until 11:00 PM)');
  const f = t.readFilters();
  assert.deepEqual(f.map((x) => x.name), ['Party', 'Halloween kid', 'Halloween grownup', 'Thanksgiving']);
  assert.deepEqual(f.map((x) => x.source), ['custom', 'github', 'github', 'github']);
});

test('a custom filter named like a GitHub filter is left out and logged', () => {
  const { T: t, logs } = startingBox({ filters: [{ name: 'halloween KID', anyOf: ['x'], schedule: ALWAYS }, party] });
  t.readFilters();
  const custom = t.readFilters().filter((x) => x.source === 'custom');
  assert.deepEqual(custom.map((x) => x.name), ['Party']);
  const msg = 'ERROR: Ignoring filter 1 (halloween KID): GitHub has a filter called Halloween kid.';
  assert.equal(logs.filter((l) => l === msg).length, 1, logs.join('\n'));
});

test("an override for a custom filter that clashes with GitHub isn't ended", () => {
  const box = startingBox({ filters: [{ name: 'thanksgiving', anyOf: ['x'], schedule: ALWAYS }] });
  box.files[box.T.OVERRIDE_PATH] = JSON.stringify({ tags: [], filters: ['Halloween grownup'], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  box.files[ROOT + '/github-filters.json'] = JSON.stringify({ filters: JSON.parse(STARTING).filters.filter((x) => x.name !== 'Halloween grownup') });
  show(box.T, at(10, 20, 18));
  assert.ok(box.T.OVERRIDE_PATH in box.files, 'kept while the filters have a mistake in them');
});

test('a filter without days and times is refused and skipped', async () => {
  const late = { name: 'Late', anyOf: ['halloween'], schedule: [{ from: '01-01', to: '12-31', weekdays: ['fri'], times: [{ start: '22:00', stop: '01:00' }] }] };
  const { T: t, logs } = load({ filters: [{ name: 'Favorites', anyOf: ['favorites'] }, late] });
  assert.deepEqual(t.readFilters().map((f) => f.name), ['Late']);
  assert.ok(logs.some((l) => l.startsWith('ERROR: Ignoring filter 1 (Favorites): a filter needs days and times')), logs.join('\n'));
  // The website refuses to save one.
  const { createWebsite } = require('../website.js');
  const files = { [ROOT + '/upload-pin']: '4321\n', [ROOT + '/filters.json']: JSON.stringify({ filters: [late] }) };
  const w = createWebsite({ config, videoRoot: ROOT, now: () => at(10, 20, 18), readText: (p) => (p in files ? files[p] : null),
    writeText: (p, x) => { files[p] = x; }, removeFile: (p) => { delete files[p]; }, listFolder: () => null, readTail: () => null, startSync: () => true });
  const r = await w.handle({ method: 'POST', path: '/api/filters', headers: { 'x-upload-pin': '4321' },
    body: JSON.stringify({ filters: [{ name: 'Party', anyOf: ['halloween'] }] }) });
  assert.equal(JSON.parse(r.body).error, 'Party: a filter needs days and times; to play tags any time, pick them under Play.');
});

(async () => {
  for (const [name, f] of tests) {
    try { await f(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
