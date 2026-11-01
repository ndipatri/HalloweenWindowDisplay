// Tests for video_scheduler.js's logic, run with Node (no Mac needed):
//   node scheduler/tests/scheduler.test.js
// The macOS parts (windows, AVFoundation, files) are replaced with fakes.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SCRIPT = path.join(__dirname, '..', 'video_scheduler.js');

// Loads the scheduler with fakes. `files` maps paths to file contents;
// `dirs` maps folder paths to lists of names in them.
function load({ files = {}, dirs = {} } = {}) {
  const logs = [];
  const nil = { isNil: () => true };
  const wrap = (v) => (v === undefined ? nil : { isNil: () => false, value: v });
  const ctx = {
    console: { log: (m) => logs.push(m) },
    ObjC: { import() {}, unwrap: (x) => (x && x.value !== undefined ? x.value : x), deepUnwrap: (x) => x.value },
    $: {
      NSHomeDirectory: () => '/Users/test',
      NSFileManager: { defaultManager: { contentsOfDirectoryAtPathError: (p) => wrap(dirs[p]) } },
      NSURL: { fileURLWithPath: (p) => ({ path: p }) },
      NSClassFromString: (name) =>
        name === 'AVPlayerItem'
          ? { playerItemWithURL: (url) => ({ isNil: () => false, status: 1, url }) }
          : { alloc: { get init() { return new FakeQueuePlayer(); } } },
    },
  };
  vm.createContext(ctx);
  const source = fs.readFileSync(SCRIPT, 'utf8').replace(/\nmain\(\);\s*$/, '\n');
  vm.runInContext(
    source +
      `;readText = (p) => (p in FILES ? FILES[p] : null);
       writeText = (p, t) => { FILES[p] = t; };
       removeFile = (p) => { delete FILES[p]; };
       fileName = (item) => item.url.path.split('/').pop();
       this.T = { CONFIG, OVERRIDE_PATH, validSchedule, validSeasons, activeSeason, resolve,
                  foldersFor, whatToShow, createPlaylist, keepPlaying, parseOverride };`,
    Object.assign(ctx, { FILES: files }),
  );
  return { T: ctx.T, logs, files, dirs };
}

class FakeQueuePlayer {
  constructor() { this.q = []; this.status = 0; this.rate = 0; }
  get items() { const q = this.q; return { get count() { return q.length; }, get lastObject() { return q[q.length - 1]; } }; }
  get currentItem() { return this.q[0] || { isNil: () => true }; }
  replaceCurrentItemWithPlayerItem(item) { this.q = [item, ...this.q.slice(1)]; }
  insertItemAfterItem(item, after) {
    if (after == null) throw new Error('-[NSNull _nameForLogging]: unrecognized selector');
    this.q.splice(this.q.indexOf(after) + 1, 0, item);
  }
  get advanceToNextItem() { this.q.shift(); return undefined; }
}

const at = (month, day, h = 12, m = 0) => new Date(2026, month - 1, day, h, m);
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

const { T } = load();
const schedule = T.validSchedule(T.CONFIG.schedule);
const seasons = T.validSeasons(T.CONFIG.seasons);
const fresh = () => ({ warnedText: null });

// ---- Seasons ----

test('configured seasons are all valid', () => assert.equal(seasons.length, T.CONFIG.seasons.length));

test('season boundaries are inclusive', () => {
  assert.equal(T.activeSeason(seasons, at(9, 30)), null);
  assert.equal(T.activeSeason(seasons, at(10, 1, 0, 0)), 'halloween');
  assert.equal(T.activeSeason(seasons, at(10, 31, 23, 59)), 'halloween');
  assert.equal(T.activeSeason(seasons, at(11, 1, 0, 0)), 'thanksgiving');
  assert.equal(T.activeSeason(seasons, at(11, 30)), 'thanksgiving');
  assert.equal(T.activeSeason(seasons, at(12, 1)), 'christmas');
  assert.equal(T.activeSeason(seasons, at(12, 31)), 'christmas');
  assert.equal(T.activeSeason(seasons, at(1, 1)), null);
});

test('a season can wrap the new year, and the first listed wins on overlap', () => {
  const s = T.validSeasons([
    { name: 'winter', from: '12-15', to: '01-06' },
    { name: 'christmas', from: '12-01', to: '12-31' },
  ]);
  assert.equal(T.activeSeason(s, at(12, 10)), 'christmas');
  assert.equal(T.activeSeason(s, at(12, 20)), 'winter');
  assert.equal(T.activeSeason(s, at(1, 6)), 'winter');
  assert.equal(T.activeSeason(s, at(1, 7)), null);
});

test('bad season entries are skipped and logged', () => {
  const { T: t, logs } = load();
  const s = t.validSeasons([
    { name: 'ok', from: '02-29', to: '03-01' },
    { name: 'thanksgiving', from: '11-01', to: '11-31' },
    { name: 'a/b', from: '01-01', to: '01-02' },
    { name: '.hidden', from: '01-01', to: '01-02' },
    { name: 'x', from: '1-1', to: '01-02' },
  ]);
  assert.deepEqual(s.map((x) => x.name), ['ok']);
  assert.equal(logs.length, 4);
});

// ---- Which videos play ----

test('a playlist name resolves to today\'s season', () => {
  assert.equal(T.resolve('kid', seasons, at(10, 20)), 'halloween/kid');
  assert.equal(T.resolve('grownup', seasons, at(12, 5)), 'christmas/grownup');
  assert.equal(T.resolve('kid', seasons, at(2, 1)), null);
  assert.equal(T.resolve('christmas', seasons, at(10, 20)), 'christmas');
  assert.equal(T.resolve('christmas/kid', seasons, at(10, 20)), 'christmas/kid');
  assert.equal(T.resolve(null, seasons, at(10, 20)), null);
});

test('a season playlist plays the season folder plus its subfolder', () => {
  assert.deepEqual(Array.from(T.foldersFor('halloween/grownup', seasons)), ['halloween', 'halloween/grownup']);
  assert.deepEqual(Array.from(T.foldersFor('christmas', seasons)), ['christmas']);
});

test('without seasons, playlists are folders in videoRoot all year', () => {
  assert.equal(T.resolve('kid', [], at(2, 1)), 'kid');
  assert.deepEqual(Array.from(T.foldersFor('kid', [])), ['kid']);
});

// ---- Status ----

test('schedule status names the season', () => {
  assert.equal(T.whatToShow(schedule, seasons, at(10, 20, 18), fresh()).status, 'halloween/kid (scheduled until 7:30 PM)');
  assert.equal(T.whatToShow(schedule, seasons, at(10, 20, 20), fresh()).status, 'halloween/grownup (scheduled until 11:00 PM)');
  assert.equal(T.whatToShow(schedule, seasons, at(10, 20, 23, 30), fresh()).status, 'black (outside schedule until Wed 5:00 AM)');
  assert.equal(T.whatToShow(schedule, seasons, at(10, 20, 12), fresh()).playlist, null);
});

test('a scheduled period on a day with no season is black', () => {
  const r = T.whatToShow(schedule, seasons, at(1, 15, 18), fresh());
  assert.equal(r.playlist, null);
  assert.equal(r.status, 'black (no season today, Jan 15)');
});

test('the season switches at midnight inside a period that crosses it', () => {
  const s = T.validSchedule([{ start: '22:00', stop: '02:00', playlist: 'grownup' }]);
  const r = T.whatToShow(s, seasons, at(10, 31, 23), fresh());
  assert.equal(r.status, 'halloween/grownup (scheduled until Sun 12:00 AM)');
  assert.equal(T.whatToShow(s, seasons, at(11, 1, 0, 30), fresh()).playlist, 'thanksgiving/grownup');
});

// ---- Overrides ----

function withOverride(o, date) {
  const { T: t, files } = load();
  files[t.OVERRIDE_PATH] = JSON.stringify(Object.assign({ setAt: +at(10, 20, 17), expires: null, untilCleared: false }, o));
  return t.whatToShow(schedule, seasons, date, fresh());
}

test('override with a plain playlist uses today\'s season', () => {
  const r = withOverride({ playlist: 'grownup', untilCleared: true }, at(10, 20, 18));
  assert.equal(r.playlist, 'halloween/grownup');
  assert.equal(r.status, 'halloween/grownup (override until cleared)');
});

test('override can preview another season, with or without a playlist', () => {
  assert.equal(withOverride({ playlist: 'christmas', untilCleared: true }, at(10, 20, 18)).playlist, 'christmas');
  assert.equal(withOverride({ playlist: 'christmas/grownup', untilCleared: true }, at(10, 20, 18)).playlist, 'christmas/grownup');
});

test('override of a plain playlist on a day with no season explains the black', () => {
  const r = withOverride({ playlist: 'kid', untilCleared: true, setAt: +at(1, 15, 17) }, at(1, 15, 18));
  assert.equal(r.playlist, null);
  assert.equal(r.status, 'black (override until cleared; asked for kid but no season today)');
});

test('an override "until the schedule changes" ends at the next period', () => {
  const r = withOverride({ playlist: null }, at(10, 20, 19, 29));
  assert.equal(r.status, 'black (override until the schedule changes at 7:30 PM)');
  assert.equal(withOverride({ playlist: null }, at(10, 20, 19, 30)).playlist, 'halloween/grownup');
});

test('override file validation', () => {
  const ok = (p) => T.parseOverride(JSON.stringify({ playlist: p, setAt: 1 })).ok;
  assert.ok(ok('kid') && ok('christmas/kid') && ok(null));
  assert.ok(!ok('../x') && !ok('a/b/c') && !ok('.hidden') && !ok('a/.b') && !ok(''));
});

// ---- Building and playing a playlist ----

const ROOT = '/Users/test/video-scheduler';

test('season videos and subfolder videos play together, in name order, round and round', () => {
  const { T: t } = load({ dirs: {
    [ROOT + '/halloween']: ['grownup', 'fuzzy.mp4', 'mochi.mp4', 'notes.txt', '.DS_Store'],
    [ROOT + '/halloween/grownup']: ['jump.mp4', 'lady.mp4'],
  } });
  const p = t.createPlaylist('halloween/grownup', seasons);
  const played = [];
  for (let i = 0; i < 8; i++) {
    t.keepPlaying(p);
    played.push(p.player.q[0].url.path.replace(ROOT + '/', ''));
    p.player.advanceToNextItem;
  }
  assert.deepEqual(played, [
    'halloween/fuzzy.mp4', 'halloween/grownup/jump.mp4', 'halloween/grownup/lady.mp4', 'halloween/mochi.mp4',
    'halloween/fuzzy.mp4', 'halloween/grownup/jump.mp4', 'halloween/grownup/lady.mp4', 'halloween/mochi.mp4',
  ]);
});

test('a season without the playlist subfolder plays just its own videos', () => {
  const { T: t, logs } = load({ dirs: { [ROOT + '/halloween']: ['fuzzy.mp4', 'mochi.mp4'] } });
  const p = t.createPlaylist('halloween/kid', seasons);
  assert.equal(t.keepPlaying(p), true);
  assert.deepEqual(p.player.q.map((i) => i.url.path.split('/').pop()), ['fuzzy.mp4', 'mochi.mp4', 'fuzzy.mp4']);
  assert.ok(!logs.some((l) => /ERROR/.test(l)));
});

test('the same file name in both folders plays both copies', () => {
  const { T: t } = load({ dirs: { [ROOT + '/halloween']: ['a.mp4'], [ROOT + '/halloween/kid']: ['a.mp4'] } });
  const p = t.createPlaylist('halloween/kid', seasons);
  t.keepPlaying(p);
  assert.deepEqual(p.player.q.map((i) => i.url.path.replace(ROOT + '/', '')), ['halloween/a.mp4', 'halloween/kid/a.mp4', 'halloween/a.mp4']);
});

test('a missing season folder is reported once (not as an error) and shows black', () => {
  const { T: t, logs } = load({ dirs: {} });
  const p = t.createPlaylist('thanksgiving/kid', seasons);
  assert.equal(t.keepPlaying(p), false);
  assert.equal(t.keepPlaying(p), false);
  assert.equal(logs.filter((l) => /No folder .*thanksgiving, so showing black/.test(l)).length, 1);
  assert.ok(!logs.some((l) => /ERROR/.test(l)));
});

test('an empty season is reported once and shows black', () => {
  const { T: t, logs } = load({ dirs: { [ROOT + '/thanksgiving']: [] } });
  const p = t.createPlaylist('thanksgiving/kid', seasons);
  assert.equal(t.keepPlaying(p), false);
  t.keepPlaying(p);
  assert.equal(logs.filter((l) => /No videos for thanksgiving\/kid/.test(l)).length, 1);
});

test('without seasons, a playlist folder plays as before', () => {
  const { T: t } = load({ dirs: { [ROOT + '/kid']: ['2-b.mp4', '10-c.mp4', '1-a.mp4'] } });
  const p = t.createPlaylist('kid', []);
  t.keepPlaying(p);
  assert.deepEqual(p.player.q.map((i) => i.url.path.split('/').pop()), ['1-a.mp4', '2-b.mp4', '10-c.mp4']);
});

console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
