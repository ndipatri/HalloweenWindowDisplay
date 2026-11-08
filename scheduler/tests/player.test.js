// Tests for the box's player (scheduler/player.js), run with Node:
//   node scheduler/tests/player.test.js
// mpv, the clock, files and folders are replaced with fakes.
'use strict';
const assert = require('assert');
const config = require('../config.js');
const { createPlayer, watchMpv } = require('../player.js');
const { FakeMpv, FakeChild } = require('./fake_mpv.js');

const ROOT = '/home/test/video-scheduler';
const STARTING = require('fs').readFileSync(require('path').join(__dirname, '..', 'filters.default.json'), 'utf8');
const at = (month, day, h = 12, m = 0) => new Date(2026, month - 1, day, h, m);

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// A player with fake everything. `dirs` maps folder paths (relative to the
// video folder) to the names in them. Set `box.now` and `box.clockSet`
// before each tick.
function box(dirs = {}) {
  const files = { [ROOT + '/filters.json']: STARTING };
  const logs = [];
  const folders = { [ROOT]: [] };
  for (const [k, v] of Object.entries(dirs)) {
    folders[ROOT + '/' + k] = v;
    if (!k.includes('/') && !folders[ROOT].includes(k)) folders[ROOT].push(k);
  }
  const mpv = new FakeMpv();
  const b = {
    files, logs, folders, mpv, now: at(10, 20, 18), clockSet: true,
    rel: () => mpv.files().map((f) => f.replace(ROOT + '/', '')),
  };
  b.player = createPlayer({
    config,
    videoRoot: ROOT,
    mpv,
    now: () => b.now,
    clockIsSet: () => b.clockSet,
    readText: (p) => (p in files ? files[p] : null),
    writeText: (p, text) => { files[p] = text; },
    removeFile: (p) => {
      delete files[p];
      const dir = p.slice(0, p.lastIndexOf('/'));
      if (folders[dir]) folders[dir] = folders[dir].filter((n) => dir + '/' + n !== p);
    },
    listFolder: (p) => (p in folders ? folders[p].slice() : null),
    log: (m) => logs.push(m),
  });
  b.tick = () => b.player.tick();
  return b;
}

// ---- Plays the schedule through mpv ----

test('the box plays the scheduled filter', async () => {
  const b = box({ halloween: ['fuzzy.mp4', 'mochi.mp4'] });
  await b.tick();
  assert.deepEqual(b.rel(), ['halloween/fuzzy.mp4', 'halloween/mochi.mp4', 'halloween/fuzzy.mp4']);
  assert.equal(b.mpv.playing(), ROOT + '/halloween/fuzzy.mp4');
  await b.tick(); // what started playing is logged on the next tick
  assert.ok(b.logs.includes('Halloween kid: playing fuzzy.mp4'), b.logs.join('\n'));
});

test('the box switches filters when the schedule changes', async () => {
  const b = box({ halloween: ['fuzzy.mp4', 'grownup'], 'halloween/grownup': ['jump.mp4'] });
  b.now = at(10, 20, 19, 29);
  await b.tick();
  assert.deepEqual(b.rel(), ['halloween/fuzzy.mp4', 'halloween/fuzzy.mp4', 'halloween/fuzzy.mp4']);
  b.now = at(10, 20, 19, 30);
  await b.tick();
  assert.deepEqual(b.rel().slice(0, 2), ['halloween/fuzzy.mp4', 'halloween/grownup/jump.mp4']);
  assert.equal(b.files[ROOT + '/status'], 'Halloween grownup (scheduled until 11:00 PM)\n');
});

test('a filter that comes back resumes at the item it was on', async () => {
  const b = box({ halloween: ['a.mp4', 'b.mp4', 'c.mp4'] });
  await b.tick();
  b.mpv.finish(); // a ends, b plays
  await b.tick();
  assert.equal(b.mpv.playing(), ROOT + '/halloween/b.mp4');
  const override = ROOT + '/override.json';
  b.files[override] = JSON.stringify({ filter: null, setAt: +b.now, expires: null, untilCleared: true });
  await b.tick();
  assert.deepEqual(b.rel(), []);
  delete b.files[override];
  await b.tick();
  assert.equal(b.rel()[0], 'halloween/b.mp4');
});

test('an item added while playing is queued without a restart', async () => {
  const b = box({ halloween: ['a.mp4'] });
  await b.tick();
  b.folders[ROOT + '/halloween'].push('b.mp4');
  b.mpv.finish();
  await b.tick();
  const files = b.rel();
  assert.ok(files.indexOf('halloween/b.mp4') > files.indexOf('halloween/a.mp4'), files.join(', '));
  assert.ok(b.logs.includes('Halloween kid: playing a.mp4'), b.logs.join('\n'));
});

test('the box keeps the next items queued', async () => {
  const b = box({ halloween: ['a.mp4', 'b.mp4', 'c.mp4'] });
  for (let i = 0; i < 5; i++) {
    await b.tick();
    const files = b.rel();
    assert.equal(files.length, 3, 'after video ' + i + ': ' + files.join(', '));
    assert.equal(b.mpv.playing(), b.mpv.files()[0]);
    b.mpv.finish();
  }
  assert.ok(b.logs.includes('Halloween kid: playing c.mp4'), b.logs.join('\n'));
});

// ---- Black when nothing should play ----

test('the box shows black when nothing is scheduled', async () => {
  const b = box({ halloween: ['fuzzy.mp4'] });
  await b.tick();
  assert.ok(b.mpv.playing());
  b.now = at(10, 20, 23, 30);
  await b.tick();
  assert.equal(b.mpv.playing(), null);
  assert.deepEqual(b.rel(), []);
  assert.equal(b.files[ROOT + '/status'], 'black (nothing scheduled until Wed 5:00 AM)\n');
});

test('the box shows black while an override chooses black', async () => {
  const b = box({ halloween: ['fuzzy.mp4'] });
  await b.tick();
  assert.ok(b.mpv.playing());
  b.files[ROOT + '/override.json'] = JSON.stringify({ filter: null, setAt: +b.now, expires: null, untilCleared: true });
  await b.tick();
  assert.equal(b.mpv.playing(), null);
  assert.deepEqual(b.rel(), []);
  assert.equal(b.files[ROOT + '/status'], 'black (override until cleared)\n');
});

// ---- Black until the clock is set ----

test('the box stays black until the clock is set', async () => {
  const b = box({ halloween: ['fuzzy.mp4'] });
  b.clockSet = false;
  await b.tick();
  assert.equal(b.mpv.playing(), null);
  assert.deepEqual(b.rel(), []);
  assert.equal(b.files[ROOT + '/status'], 'black (waiting for the clock to be set)\n');
});

test('the box starts playing once the clock is set', async () => {
  const b = box({ halloween: ['fuzzy.mp4'] });
  b.clockSet = false;
  await b.tick();
  b.clockSet = true;
  await b.tick();
  assert.equal(b.mpv.playing(), ROOT + '/halloween/fuzzy.mp4');
  assert.equal(b.files[ROOT + '/status'], 'Halloween kid (scheduled until 7:30 PM)\n');
});

// ---- Reports what it shows ----

test('the box writes what it is showing to the status file and the log', async () => {
  const b = box({ halloween: ['fuzzy.mp4'] });
  await b.tick();
  await b.tick();
  assert.equal(b.files[ROOT + '/status'], 'Halloween kid (scheduled until 7:30 PM)\n');
  assert.equal(b.logs.filter((l) => l === 'Now showing: Halloween kid (scheduled until 7:30 PM)').length, 1);
  assert.equal(b.logs.filter((l) => l === 'Halloween kid: playing fuzzy.mp4').length, 1);
});

// ---- Skips videos mpv cannot play ----

test("the box skips an item mpv can't play and logs it once", async () => {
  const b = box({ halloween: ['bad.mp4', 'good.mp4'] });
  await b.tick(); // queue: bad, good, bad
  b.mpv.fail(); // bad fails, good plays
  await b.tick();
  assert.equal(b.mpv.playing(), ROOT + '/halloween/good.mp4');
  b.mpv.finish(); // good ends, bad again
  b.mpv.fail(); // bad fails again
  await b.tick();
  const skips = b.logs.filter((l) => l.startsWith('ERROR: Skipping'));
  assert.equal(skips.length, 1, b.logs.join('\n'));
  assert.ok(skips[0].startsWith('ERROR: Skipping bad.mp4 in Halloween kid'), skips[0]);
  assert.equal(b.mpv.playing(), ROOT + '/halloween/good.mp4');
});

// ---- Recovers when mpv stops ----

test('the box exits when mpv stops, so it is restarted', () => {
  const logs = [];
  let exitCode = null;
  const child = new FakeChild();
  watchMpv(child, { log: (m) => logs.push(m), exit: (code) => { exitCode = code; } });
  child.exit(1);
  assert.deepEqual(logs, ['ERROR: mpv stopped (exit code 1). Exiting so the box restarts.']);
  assert.equal(exitCode, 1);
});

// ---- Photos ----

const { mpvArgs } = require('../mpv.js');

test('the box shows each photo for 10 seconds', () => {
  const args = mpvArgs(config.box, config);
  assert.ok(args.includes('--image-display-duration=10'), args.join(' '));
  for (const a of ['--keepaspect=yes', '--panscan=0', '--background=color', '--background-color=#000000']) {
    assert.ok(args.includes(a), 'mpv gets ' + a);
  }
});

test('the box decodes HEVC in hardware and H.264 in software', () => {
  const args = mpvArgs(config.box, config);
  assert.ok(args.includes('--hwdec=drm'), args.join(' '));
  assert.ok(args.includes('--hwdec-codecs=hevc'), args.join(' '));
  assert.ok(!args.includes('--hwdec=no'));
});

// The box playing Photos, with its website wired to it as on the box.
async function photosPlaying() {
  const b = box({ photos: ['00001-a.jpg', '00002-b.mp4', '00003-c.png'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ filter: 'All uploads', setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  b.files[ROOT + '/upload-pin'] = '4321\n';
  await b.tick();
  const { createWebsite } = require('../website.js');
  const site = createWebsite({
    config, videoRoot: ROOT, now: () => b.now, log: (m) => b.logs.push(m),
    readText: (p) => (p in b.files ? b.files[p] : null),
    writeText: (p, t) => { b.files[p] = t; },
    removeFile: (p) => {
      delete b.files[p];
      b.folders[ROOT + '/photos'] = b.folders[ROOT + '/photos'].filter((n) => ROOT + '/photos/' + n !== p);
    },
    listFolder: (p) => (p in b.folders ? b.folders[p].slice() : null),
    fileSize: () => 1,
    readTail: () => null,
    startSync: () => true,
    freeBytes: () => 0,
    beforeRemove: (p) => b.player.dropFile(p),
  });
  b.remove = (name) => site.handle({
    method: 'POST', path: '/api/uploads/remove', headers: { 'x-upload-pin': '4321' }, body: JSON.stringify({ name }),
  });
  return b;
}

test('removing the upload on screen moves on to the next', async () => {
  const b = await photosPlaying();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg');
  const r = await b.remove('00001-a.jpg');
  assert.equal(r.status, 200, r.body);
  assert.equal(b.mpv.playing(), ROOT + '/photos/00002-b.mp4');
  assert.equal(b.rel()[0], 'photos/00002-b.mp4');
  assert.ok(!b.rel().includes('photos/00001-a.jpg'), b.rel().join(' '));
  await b.tick();
  assert.ok(!b.logs.some((l) => l.startsWith('ERROR')), b.logs.join('\n'));
});

test('removing a queued upload takes it out of the queue', async () => {
  const b = await photosPlaying();
  const r = await b.remove('00002-b.mp4');
  assert.equal(r.status, 200, r.body);
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg');
  assert.ok(!b.rel().includes('photos/00002-b.mp4'), b.rel().join(' '));
  await b.tick();
  assert.ok(!b.rel().includes('photos/00002-b.mp4'), b.rel().join(' '));
  assert.ok(!b.logs.some((l) => l.startsWith('ERROR')), b.logs.join('\n'));
});

// ---- Tags or filters changing while a filter plays ----

// The box playing Favorites: uploads a, b, c, tagged favorites as given.
async function favoritesPlaying(tagged) {
  const b = box({ photos: ['00001-a.jpg', '00002-b.jpg', '00003-c.jpg'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ filter: 'Favorites', setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  b.tag = (paths) => {
    const tags = {};
    for (const p of paths) tags['photos/' + p] = ['favorites'];
    b.files[ROOT + '/tags.json'] = JSON.stringify({ tags });
  };
  b.tag(tagged);
  await b.tick();
  b.refilter = async () => {
    assert.equal(typeof b.player.refilter, 'function', 'the player has refilter');
    await b.player.refilter();
  };
  return b;
}

test('tagging an item while its filter plays queues it in its place', async () => {
  const b = await favoritesPlaying(['00001-a.jpg', '00003-c.jpg']);
  assert.deepEqual(b.rel(), ['photos/00001-a.jpg', 'photos/00003-c.jpg', 'photos/00001-a.jpg']);
  b.tag(['00001-a.jpg', '00002-b.jpg', '00003-c.jpg']);
  await b.refilter();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg');
  assert.deepEqual(b.rel(), ['photos/00001-a.jpg', 'photos/00002-b.jpg', 'photos/00003-c.jpg']);
});

test('untagging the item on screen moves on to the next item', async () => {
  const b = await favoritesPlaying(['00001-a.jpg', '00002-b.jpg', '00003-c.jpg']);
  const stops = () => b.mpv.commands.filter((c) => c[0] === 'stop').length;
  const before = stops();
  b.tag(['00002-b.jpg', '00003-c.jpg']);
  await b.refilter();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00002-b.jpg');
  assert.deepEqual(b.rel(), ['photos/00002-b.jpg', 'photos/00003-c.jpg', 'photos/00002-b.jpg']);
  assert.equal(stops(), before, 'mpv was never stopped (no black gap)');
  await b.tick();
  assert.ok(!b.logs.some((l) => l.startsWith('ERROR')), b.logs.join('\n'));
});

test('untagging the last item on screen goes round to the first', async () => {
  const b = await favoritesPlaying(['00001-a.jpg', '00002-b.jpg', '00003-c.jpg']);
  b.mpv.finish(); b.mpv.finish(); // c, the last, on screen
  await b.tick();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00003-c.jpg');
  b.tag(['00001-a.jpg', '00002-b.jpg']);
  await b.refilter();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg');
  assert.ok(!b.rel().includes('photos/00003-c.jpg'), b.rel().join(' '));
});

test('untagging everything while a filter plays shows black and says so once', async () => {
  const b = await favoritesPlaying(['00001-a.jpg', '00002-b.jpg']);
  b.tag([]);
  await b.refilter();
  await b.tick();
  await b.tick();
  assert.equal(b.mpv.playing(), null);
  const none = 'Nothing in Favorites yet (any of favorites). Showing black until something is tagged.';
  assert.equal(b.logs.filter((l) => l === none).length, 1, b.logs.join('\n'));
});

test('tagging while a filter shows black starts it at once', async () => {
  const b = await favoritesPlaying([]);
  assert.equal(b.mpv.playing(), null);
  b.tag(['00002-b.jpg']);
  await b.refilter();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00002-b.jpg');
});

test("changing tags that don't touch the playing filter leaves its queue as it was", async () => {
  const b = box({ halloween: ['fuzzy.mp4'], photos: ['00001-a.jpg'] });
  await b.tick(); // Halloween kid, scheduled
  const before = b.rel();
  b.files[ROOT + '/tags.json'] = JSON.stringify({ tags: { 'photos/00001-a.jpg': ['favorites'] } });
  await b.player.refilter();
  assert.deepEqual(b.rel(), before);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
