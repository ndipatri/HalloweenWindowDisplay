// Tests for the scheduler's logic (scheduler/logic.js), run with Node:
//   node scheduler/tests/scheduler.test.js
// Files, folders and mpv are replaced with fakes.
'use strict';
const assert = require('assert');
const { createScheduler } = require('../logic.js');
const config = require('../config.js');
const { FakeMpv } = require('./fake_mpv.js');

const ROOT = '/home/test/video-scheduler';

// Loads the scheduler with fakes. `files` maps paths to file contents;
// `dirs` maps folder paths to lists of names in them.
function load({ files = {}, dirs = {} } = {}) {
  const logs = [];
  const T = createScheduler({
    config,
    videoRoot: ROOT,
    readText: (p) => (p in files ? files[p] : null),
    writeText: (p, text) => { files[p] = text; },
    removeFile: (p) => { delete files[p]; },
    listFolder: (p) => (p in dirs ? dirs[p].slice() : null),
    log: (m) => logs.push(m),
  });
  return { T, logs, files, dirs };
}

const at = (month, day, h = 12, m = 0) => new Date(2026, month - 1, day, h, m);
let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

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
  assert.equal(T.activeSeason(seasons, at(11, 6, 0, 0)), 'thanksgiving');
  assert.equal(T.activeSeason(seasons, at(12, 1)), 'christmas');
  assert.equal(T.activeSeason(seasons, at(12, 31)), 'christmas');
  assert.equal(T.activeSeason(seasons, at(1, 1)), null);
});

// Days of Thanksgiving in a month, with the configured seasons.
const thanksgivingDays = (year) => {
  const days = [];
  for (let d = 1; d <= 30; d++) {
    if (T.activeSeason(seasons, new Date(year, 10, d, 20)) === 'thanksgiving') days.push(d);
  }
  return days;
};

test('Thanksgiving: Fridays and Saturdays until Thanksgiving, then the day before and the day', () => {
  // 2026: Thanksgiving is Thu Nov 26.
  assert.deepEqual(thanksgivingDays(2026), [6, 7, 13, 14, 20, 21, 25, 26]);
  // 2027: Thanksgiving is Thu Nov 25, and it moves with the year.
  assert.deepEqual(thanksgivingDays(2027), [5, 6, 12, 13, 19, 20, 24, 25]);
  // 2025: Thanksgiving is Thu Nov 27; Sat Nov 1 is in.
  assert.deepEqual(thanksgivingDays(2025), [1, 7, 8, 14, 15, 21, 22, 26, 27]);
});

test('days written as the nth or last weekday of a month, with offsets', () => {
  const day = (text, year, withYear = false) => {
    const d = T.parseDay(text, withYear)(year);
    return d && [d.year, d.month, d.day].join('-');
  };
  assert.equal(day('11-4thu', 2026), '2026-11-26');
  assert.equal(day('11-4th thu'.replace(' ', ''), 2026), '2026-11-26');
  assert.equal(day('11-4thu-1', 2026), '2026-11-25');
  assert.equal(day('11-4thu+1', 2026), '2026-11-27');
  assert.equal(day('05-lastmon', 2026), '2026-5-25');
  assert.equal(day('09-1mon', 2026), '2026-9-7');
  assert.equal(day('11-5thu', 2026), null); // no 5th Thursday in Nov 2026
  assert.equal(day('02-29', 2026), null);
  assert.equal(day('02-29', 2028), '2028-2-29');
  assert.equal(day('01-01-1', 2026), '2025-12-31');
  assert.equal(day('2026-11-14', 2026, true), '2026-11-14');
  assert.equal(day('2026-11-14', 2027, true), null);
  for (const bad of ['11-4xyz', '11-6thu', '13-01', '11-31', '11-04thu', 'thanksgiving', '']) {
    assert.equal(T.parseDay(bad, true), null, bad);
  }
  assert.equal(T.parseDay('2026-11-14', false), null); // a year only in alsoOn
});

test('days, and alsoOn days outside the season or with a year', () => {
  const s = T.validSeasons([
    { name: 'weekends', from: '06-01', to: '06-30', days: ['Saturday', 'sun'], alsoOn: ['07-04', '2026-08-15'] },
  ]);
  assert.equal(T.activeSeason(s, at(6, 6)), 'weekends'); // Sat
  assert.equal(T.activeSeason(s, at(6, 7)), 'weekends'); // Sun
  assert.equal(T.activeSeason(s, at(6, 8)), null); // Mon
  assert.equal(T.activeSeason(s, at(7, 4)), 'weekends'); // outside from..to
  assert.equal(T.activeSeason(s, at(8, 15)), 'weekends');
  assert.equal(T.activeSeason(s, new Date(2027, 7, 15, 12)), null);
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
    { name: 'y', from: '11-01', to: '11-4thu', days: ['funday'] },
    { name: 'z', from: '11-01', to: '11-4thu', days: [] },
    { name: 'w', from: '11-01', to: '11-30', alsoOn: '11-4thu' },
    { name: 'v', from: '11-01', to: '11-30', alsoOn: ['11-4thux'] },
  ]);
  assert.deepEqual(s.map((x) => x.name), ['ok']);
  assert.equal(logs.length, 8);
  assert.ok(logs.some((l) => /bad alsoOn day "11-4thux"/.test(l)));
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
  const ss = T.validSeasons([
    { name: 'halloween', from: '10-01', to: '10-31' },
    { name: 'thanksgiving', from: '11-01', to: '11-30' },
  ]);
  const r = T.whatToShow(s, ss, at(10, 31, 23), fresh());
  assert.equal(r.status, 'halloween/grownup (scheduled until Sun 12:00 AM)');
  assert.equal(T.whatToShow(s, ss, at(11, 1, 0, 30), fresh()).playlist, 'thanksgiving/grownup');
});

test('on a weekday a season skips, the screen is black', () => {
  const r = T.whatToShow(schedule, seasons, at(11, 2, 20), fresh()); // Mon
  assert.equal(r.playlist, null);
  assert.equal(r.status, 'black (no season today, Nov 2)');
  assert.equal(T.whatToShow(schedule, seasons, at(11, 6, 20), fresh()).playlist, 'thanksgiving/grownup'); // Fri
});

test('a schedule period can be limited to weekdays', () => {
  const s = T.validSchedule([
    { start: '09:00', stop: '11:00', playlist: 'kid', days: ['sat', 'sun'] },
    { start: '22:00', stop: '01:00', playlist: 'grownup', days: ['fri'] },
  ]);
  assert.equal(s.length, 2);
  const name = (d) => T.whatToShow(s, [], d, fresh()).playlist;
  assert.equal(name(at(10, 24, 10)), 'kid'); // Sat
  assert.equal(name(at(10, 26, 10)), null); // Mon
  assert.equal(name(at(10, 23, 23)), 'grownup'); // Fri night
  assert.equal(name(at(10, 24, 0, 30)), 'grownup'); // after midnight: still Friday's
  assert.equal(name(at(10, 24, 23)), null); // Sat night
  assert.equal(name(at(10, 25, 0, 30)), null);
  const { T: t, logs } = load();
  assert.equal(t.validSchedule([{ start: '09:00', stop: '11:00', playlist: 'kid', days: ['someday'] }]).length, 0);
  assert.equal(logs.length, 1);
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

const rel = (paths) => paths.map((p) => p.replace(ROOT + '/', ''));

test('season videos and subfolder videos play together, in name order, round and round', async () => {
  const { T: t } = load({ dirs: {
    [ROOT + '/halloween']: ['grownup', 'fuzzy.mp4', 'mochi.mp4', 'notes.txt', '.DS_Store'],
    [ROOT + '/halloween/grownup']: ['jump.mp4', 'lady.mp4'],
  } });
  const p = t.createPlaylist('halloween/grownup', seasons);
  const mpv = new FakeMpv();
  const played = [];
  for (let i = 0; i < 8; i++) {
    await t.keepPlaying(p, mpv);
    played.push(mpv.playing().replace(ROOT + '/', ''));
    mpv.finish();
  }
  assert.deepEqual(played, [
    'halloween/fuzzy.mp4', 'halloween/grownup/jump.mp4', 'halloween/grownup/lady.mp4', 'halloween/mochi.mp4',
    'halloween/fuzzy.mp4', 'halloween/grownup/jump.mp4', 'halloween/grownup/lady.mp4', 'halloween/mochi.mp4',
  ]);
});

test('a season without the playlist subfolder plays just its own videos', async () => {
  const { T: t, logs } = load({ dirs: { [ROOT + '/halloween']: ['fuzzy.mp4', 'mochi.mp4'] } });
  const p = t.createPlaylist('halloween/kid', seasons);
  const mpv = new FakeMpv();
  assert.equal(await t.keepPlaying(p, mpv), true);
  assert.deepEqual(mpv.files().map((f) => f.split('/').pop()), ['fuzzy.mp4', 'mochi.mp4', 'fuzzy.mp4']);
  assert.ok(!logs.some((l) => /ERROR/.test(l)));
});

test('the same file name in both folders plays both copies', async () => {
  const { T: t } = load({ dirs: { [ROOT + '/halloween']: ['a.mp4'], [ROOT + '/halloween/kid']: ['a.mp4'] } });
  const p = t.createPlaylist('halloween/kid', seasons);
  const mpv = new FakeMpv();
  await t.keepPlaying(p, mpv);
  assert.deepEqual(rel(mpv.files()), ['halloween/a.mp4', 'halloween/kid/a.mp4', 'halloween/a.mp4']);
});

test('a missing season folder is reported once (not as an error) and shows black', async () => {
  const { T: t, logs } = load({ dirs: {} });
  const p = t.createPlaylist('thanksgiving/kid', seasons);
  const mpv = new FakeMpv();
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(mpv.playing(), null);
  assert.equal(logs.filter((l) => /No folder .*thanksgiving, so showing black/.test(l)).length, 1);
  assert.ok(!logs.some((l) => /ERROR/.test(l)));
});

test('an empty season is reported once and shows black', async () => {
  const { T: t, logs } = load({ dirs: { [ROOT + '/thanksgiving']: [] } });
  const p = t.createPlaylist('thanksgiving/kid', seasons);
  const mpv = new FakeMpv();
  assert.equal(await t.keepPlaying(p, mpv), false);
  await t.keepPlaying(p, mpv);
  assert.equal(logs.filter((l) => /No videos for thanksgiving\/kid/.test(l)).length, 1);
});

test('without seasons, a playlist folder plays as before', async () => {
  const { T: t } = load({ dirs: { [ROOT + '/kid']: ['2-b.mp4', '10-c.mp4', '1-a.mp4'] } });
  const p = t.createPlaylist('kid', []);
  const mpv = new FakeMpv();
  await t.keepPlaying(p, mpv);
  assert.deepEqual(mpv.files().map((f) => f.split('/').pop()), ['1-a.mp4', '2-b.mp4', '10-c.mp4']);
});

// ---- Photos ----

test('Photos plays the uploads on a season day', () => {
  const r = withOverride({ playlist: 'photos', untilCleared: true }, at(10, 20, 18));
  assert.equal(r.playlist, 'photos');
  assert.equal(r.status, 'photos (override until cleared)');
  assert.deepEqual(T.foldersFor('photos', seasons), ['photos']);
});

test('Photos plays the uploads on a day with no season', () => {
  const r = withOverride({ playlist: 'photos', untilCleared: true, setAt: +at(1, 15, 17) }, at(1, 15, 18));
  assert.equal(r.playlist, 'photos');
  assert.equal(r.status, 'photos (override until cleared)');
});

test('Photos plays the uploads when there are no seasons', () => {
  const { T: t, files } = load();
  files[t.OVERRIDE_PATH] = JSON.stringify({ playlist: 'photos', setAt: +at(2, 1, 17), expires: null, untilCleared: true });
  const r = t.whatToShow(schedule, [], at(2, 1, 18), fresh());
  assert.equal(r.playlist, 'photos');
  assert.deepEqual(t.createPlaylist('photos', []).folders, [ROOT + '/photos']);
});

test('Photos plays photos and videos in upload order, round and round', async () => {
  const { T: t } = load({ dirs: { [ROOT + '/photos']: ['00002-b.mp4', '00001-a.jpg', '00010-c.png', 'notes.txt', '.upload-123'] } });
  const p = t.createPlaylist('photos', seasons);
  const mpv = new FakeMpv();
  const played = [];
  for (let i = 0; i < 6; i++) {
    await t.keepPlaying(p, mpv);
    played.push(mpv.playing().split('/').pop());
    mpv.finish();
  }
  assert.deepEqual(played, ['00001-a.jpg', '00002-b.mp4', '00010-c.png', '00001-a.jpg', '00002-b.mp4', '00010-c.png']);
});

test("a photo in a season folder doesn't play", async () => {
  const { T: t } = load({ dirs: { [ROOT + '/halloween']: ['fuzzy.mp4', 'poster.jpg'] } });
  const p = t.createPlaylist('halloween/kid', seasons);
  const mpv = new FakeMpv();
  await t.keepPlaying(p, mpv);
  assert.deepEqual(rel(mpv.files()), ['halloween/fuzzy.mp4', 'halloween/fuzzy.mp4', 'halloween/fuzzy.mp4']);
});

const NO_UPLOADS = 'No photos or videos uploaded yet. Showing black until one is added.';

test('Photos with no uploads shows black and says so once', async () => {
  const { T: t, logs } = load({ dirs: { [ROOT + '/photos']: [] } });
  const p = t.createPlaylist('photos', seasons);
  const mpv = new FakeMpv();
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(mpv.playing(), null);
  assert.equal(logs.filter((l) => l === NO_UPLOADS).length, 1, logs.join('\n'));
  assert.ok(!logs.some((l) => /ERROR/.test(l)));
});

test('Photos with no photos folder shows black and says so once', async () => {
  const { T: t, logs } = load({ dirs: {} });
  const p = t.createPlaylist('photos', seasons);
  const mpv = new FakeMpv();
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(await t.keepPlaying(p, mpv), false);
  assert.equal(mpv.playing(), null);
  assert.equal(logs.filter((l) => l === NO_UPLOADS).length, 1, logs.join('\n'));
  assert.ok(!logs.some((l) => /ERROR/.test(l)));
});

test('a season named photos is skipped and logged', () => {
  const { T: t, logs } = load();
  const s = t.validSeasons([
    { name: 'photos', from: '06-01', to: '06-30' },
    { name: 'halloween', from: '10-01', to: '10-31' },
  ]);
  assert.deepEqual(s.map((x) => x.name), ['halloween']);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].startsWith('ERROR: Ignoring season entry 1'), logs[0]);
  assert.ok(/photos.*kept for uploads/.test(logs[0]), logs[0]);
});

test('a schedule entry for photos is skipped and logged', () => {
  const { T: t, logs } = load();
  const s = t.validSchedule([
    { start: '17:00', stop: '19:30', playlist: 'kid' },
    { start: '19:30', stop: '23:00', playlist: 'photos' },
  ]);
  assert.deepEqual(s.map((x) => x.playlist), ['kid']);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].startsWith('ERROR: Ignoring schedule entry 2'), logs[0]);
  assert.ok(/photos.*only when chosen on the website/.test(logs[0]), logs[0]);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
