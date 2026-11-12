// Tests for the box's player (scheduler/player.js), run with Node:
//   node scheduler/tests/player.test.js
// mpv, the clock, files and folders are replaced with fakes.
'use strict';
const assert = require('assert');
const config = require('../config.js');
const { createPlayer, watchMpv } = require('../player.js');
const { FakeMpv, FakeChild } = require('./fake_mpv.js');

const ROOT = '/home/test/video-scheduler';
const STARTING = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'playlists', 'filters.json'), 'utf8');
const at = (month, day, h = 12, m = 0) => new Date(2026, month - 1, day, h, m);

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// A player with fake everything. `dirs` maps folder paths (relative to the
// video folder) to the names in them. Set `box.now` and `box.clockSet`
// before each tick.
function box(dirs = {}, extra = {}) {
  const files = { [ROOT + '/github-filters.json']: STARTING };
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
    config: extra.config || config,
    readTilt: extra.readTilt,
    readAddress: extra.readAddress,
    makeAddressCode: extra.makeAddressCode,
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
    // Photos and videos are portrait unless named otherwise.
    mediaSize: (p) => {
      const n = p.split('/').pop();
      if (n.includes('broken')) return null;
      if (n.includes('wide')) return { width: 160, height: 96 };
      if (n.includes('square')) return { width: 100, height: 100 };
      return { width: 96, height: 160 };
    },
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
  b.files[override] = JSON.stringify({ tags: null, setAt: +b.now, expires: null, untilCleared: true });
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
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: null, setAt: +b.now, expires: null, untilCleared: true });
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
  for (const a of ['--keepaspect=yes', '--panscan=1', '--background=color', '--background-color=#000000']) {
    assert.ok(args.includes(a), 'mpv gets ' + a);
  }
});

test('the box sends each picture to the TV as soon as it is drawn', () => {
  // A still photo is drawn once or twice; with frames queued behind each
  // other it could wait unseen until later frames pushed it out.
  assert.ok(mpvArgs(config.box, config).includes('--swapchain-depth=1'));
});

test('the box decodes HEVC in hardware and H.264 in software', () => {
  const args = mpvArgs(config.box, config);
  assert.ok(args.includes('--hwdec=drm'), args.join(' '));
  assert.ok(args.includes('--hwdec-codecs=hevc'), args.join(' '));
  assert.ok(!args.includes('--hwdec=no'));
});

test('each photo fills the screen and each video is fitted whole', async () => {
  const b = box({ photos: ['00001-a.jpg', '00002-b.mp4', '00003-c.png'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  const queued = b.mpv.entries.map((e) => [e.filename.split('/').pop(), e.options]);
  assert.deepEqual(queued, [['00001-a.jpg', 'panscan=1.0'], ['00002-b.mp4', 'panscan=0'], ['00003-c.png', 'panscan=1.0']]);
});

test('a photo that isn\'t the screen\'s shape is shown whole', async () => {
  const b = box({ photos: ['00001-wide.jpg', '00002-wide.png'] });
  b.files[ROOT + '/tags.json'] = JSON.stringify({ tags: { 'photos/00001-wide.jpg': ['portrait'], 'photos/00002-wide.png': ['portrait'] } });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  const queued = b.mpv.entries.map((e) => [e.filename.split('/').pop(), e.options]);
  assert.deepEqual(queued, [['00001-wide.jpg', 'panscan=0'], ['00002-wide.png', 'panscan=0'], ['00001-wide.jpg', 'panscan=0']]);
});

test('a square photo plays either way, shown whole', async () => {
  const b = box({ photos: ['00001-square.png', '00002-broken.jpg', '00003-wide.jpg', '00004-tall.jpg'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  const queued = b.mpv.entries.map((e) => [e.filename.split('/').pop(), e.options]);
  assert.deepEqual(queued, [['00001-square.png', 'panscan=0'], ['00004-tall.jpg', 'panscan=1.0'], ['00001-square.png', 'panscan=0']],
    'square plays, shown whole; broken (unmeasurable) and wide do not');
  await b.tick();
  const left = b.logs.filter((l) => l.startsWith('WARNING: Leaving out 00002-broken.jpg in #upload: it can\'t be measured. Tag it'));
  assert.equal(left.length, 1, b.logs.join('\n'));
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'landscape' });
  await b.tick();
  assert.ok(b.rel().includes('photos/00003-wide.jpg') && b.rel().includes('photos/00001-square.png'), b.rel().join(' '));
  assert.ok(!b.rel().includes('photos/00002-broken.jpg'), b.rel().join(' '));
});

test('an item that can\'t be measured doesn\'t play until it has a shape tag', async () => {
  const b = box({ photos: ['00001-broken.jpg', '00002-wide.jpg'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  await b.tick();
  assert.deepEqual(b.rel(), [], 'portrait TV: the wide photo does not fit, the broken one is left out');
  const left = b.logs.filter((l) => l === "WARNING: Leaving out 00001-broken.jpg in #upload: it can't be measured. Tag it portrait or landscape to play it.");
  assert.equal(left.length, 1, b.logs.join('\n'));
  b.files[ROOT + '/tags.json'] = JSON.stringify({ tags: { 'photos/00001-broken.jpg': ['portrait'] } });
  await b.tick();
  assert.ok(b.rel().includes('photos/00001-broken.jpg'), b.rel().join(' '));
});

test('only items the TV\'s shape play', async () => {
  const b = box({ photos: ['00001-tall.jpg', '00002-tall.mp4', '00003-wide.jpg', '00004-wide.mp4'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  assert.deepEqual(b.rel(), ['photos/00001-tall.jpg', 'photos/00002-tall.mp4', 'photos/00001-tall.jpg']);
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'landscape' });
  await b.tick();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00003-wide.jpg');
  assert.deepEqual(b.rel(), ['photos/00003-wide.jpg', 'photos/00004-wide.mp4', 'photos/00003-wide.jpg']);
});

test('a shape tag decides which way an item plays', async () => {
  const b = box({ photos: ['00001-tall.jpg', '00002-wide.mp4', '00003-wide.jpg'] });
  b.files[ROOT + '/tags.json'] = JSON.stringify({ tags: { 'photos/00002-wide.mp4': ['portrait'] } });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  assert.deepEqual(b.rel(), ['photos/00001-tall.jpg', 'photos/00002-wide.mp4', 'photos/00001-tall.jpg'], 'the wide video, tagged portrait, plays portrait');
  const video = b.mpv.entries.find((e) => e.filename.endsWith('00002-wide.mp4'));
  assert.equal(video.options, 'panscan=0', 'shown whole');
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'landscape' });
  await b.tick();
  assert.deepEqual(b.rel(), ['photos/00003-wide.jpg'], 'and not landscape');
});

test('a photo tagged with the other shape is shown whole', async () => {
  const b = box({ photos: ['00001-wide.jpg', '00002-tall.jpg'] });
  b.files[ROOT + '/tags.json'] = JSON.stringify({ tags: { 'photos/00001-wide.jpg': ['portrait'] } });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  const queued = b.mpv.entries.map((e) => [e.filename.split('/').pop(), e.options]);
  assert.deepEqual(queued, [['00001-wide.jpg', 'panscan=0'], ['00002-tall.jpg', 'panscan=1.0'], ['00001-wide.jpg', 'panscan=0']]);
});

test('an item tagged both portrait and landscape keeps its measured shape', async () => {
  const b = box({ photos: ['00001-tall.jpg', '00002-wide.jpg'] });
  b.files[ROOT + '/tags.json'] = JSON.stringify({ tags: { 'photos/00002-wide.jpg': ['portrait', 'landscape'] } });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  assert.deepEqual(b.rel(), ['photos/00001-tall.jpg'], 'the wide photo stays landscape');
});

test('with nothing the TV\'s shape, the screen is black', async () => {
  const b = box({ photos: ['00001-a.jpg', '00002-b.mp4'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg', 'portrait TV: the portrait items play');
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'landscape' });
  for (let i = 0; i < 4; i++) await b.tick();
  assert.equal(b.mpv.playing(), null, 'turned landscape: black');
  assert.deepEqual(b.rel(), []);
  const said = b.logs.filter((l) => l === 'Nothing in #upload is landscape. Showing black until something is, or the TV is turned back.');
  assert.equal(said.length, 1, b.logs.join('\n'));
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'portrait' });
  await b.tick();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg', 'turned back: playing again');
});

test('the box turns the picture when the TV is turned to landscape', async () => {
  const b = box({ photos: ['00001-tall.jpg', '00002-wide.jpg'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  const queued = () => b.mpv.entries.map((e) => [e.filename.split('/').pop(), e.options]);
  assert.deepEqual(queued(), [['00001-tall.jpg', 'panscan=1.0,image-display-duration=inf']], 'tall alone, held');
  assert.equal(b.mpv.props['video-rotate'], undefined, 'portrait is how mpv starts');
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'landscape' });
  await b.tick();
  assert.equal(b.mpv.props['video-rotate'], 0);
  assert.equal(b.mpv.playing(), ROOT + '/photos/00002-wide.jpg', 'tall gave way to wide');
  assert.deepEqual(queued(), [['00002-wide.jpg', 'panscan=1.0,image-display-duration=inf']]);
  assert.ok(b.logs.some((l) => l.startsWith('Screen: landscape')), b.logs.join('\n'));
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'portrait' });
  await b.tick();
  assert.equal(b.mpv.props['video-rotate'], config.box.rotate);
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-tall.jpg', 'tall came back');
  assert.equal(b.mpv.entries[0].options, 'panscan=1.0,image-display-duration=inf');
});

test('a box started with the TV landscape turns the picture straight away', async () => {
  const b = box({ photos: ['00001-wide.jpg'] });
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'landscape' });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  const rotated = b.mpv.commands.findIndex((c) => c[0] === 'set_property' && c[1] === 'video-rotate' && c[2] === 0);
  const loaded = b.mpv.commands.findIndex((c) => c[0] === 'loadfile');
  assert.ok(rotated !== -1 && rotated < loaded, JSON.stringify(b.mpv.commands));
  assert.equal(b.mpv.entries[0].options, 'panscan=1.0,image-display-duration=inf', 'the wide photo fills a landscape TV');
});

test('a lone photo is held on screen, not reloaded', async () => {
  const b = box({ photos: ['00001-a.jpg'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  const queued = b.mpv.entries.map((e) => [e.filename.split('/').pop(), e.options]);
  assert.deepEqual(queued, [['00001-a.jpg', 'panscan=1.0,image-display-duration=inf']]);
  const loads = () => b.mpv.commands.filter((c) => c[0] === 'loadfile').length;
  await b.tick();
  await b.tick();
  assert.equal(loads(), 1);
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg');
});

test('a held photo gives way when something else is to play', async () => {
  const b = box({ photos: ['00001-a.jpg'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  await b.tick();
  b.folders[ROOT + '/photos'].push('00002-b.jpg');
  await b.tick();
  assert.equal(b.mpv.playing(), ROOT + '/photos/00002-b.jpg');
  assert.deepEqual(b.rel(), ['photos/00002-b.jpg', 'photos/00001-a.jpg', 'photos/00002-b.jpg']);
  assert.ok(b.mpv.entries.every((e) => e.options === 'panscan=1.0'), JSON.stringify(b.mpv.entries));
  assert.ok(!b.logs.some((l) => l.startsWith('ERROR')), b.logs.join('\n'));
});

// ---- The tilt switch ----

// A box with a tilt switch on GPIO17 (closed while portrait), its reading
// set with b.switchTo('open' | 'closed'); b.at(s) ticks at s seconds in.
function tiltBox(start = 'closed') {
  const withSwitch = Object.assign({}, config, { box: Object.assign({}, config.box, { tiltSwitch: { gpio: 17, closed: 'portrait' } }) });
  let reading = start;
  const b = box({ photos: ['00001-tall.jpg', '00002-wide.jpg'] }, {
    config: withSwitch,
    readTilt: async (gpio) => { assert.equal(gpio, 17); return reading; },
  });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  const t0 = +at(10, 20, 18);
  b.switchTo = (r) => { reading = r; };
  b.at = (seconds) => { b.now = new Date(t0 + seconds * 1000); return b.tick(); };
  b.screen = () => (ROOT + '/screen.json' in b.files ? JSON.parse(b.files[ROOT + '/screen.json']).orientation : 'portrait');
  return b;
}

test('the box follows the tilt switch when the TV is turned', async () => {
  const b = tiltBox();
  for (let s = 0; s <= 3; s++) await b.at(s);
  assert.equal(b.screen(), 'portrait');
  b.switchTo('open');
  await b.at(4);
  await b.at(5);
  assert.equal(b.screen(), 'portrait', 'not yet: open for 1 second');
  await b.at(6);
  assert.equal(b.screen(), 'landscape');
  assert.ok(b.logs.includes('Screen: landscape (from the tilt switch).'), b.logs.join('\n'));
  assert.equal(b.mpv.props['video-rotate'], 0, 'the picture turned in the same tick');
  b.switchTo('closed');
  for (let s = 7; s <= 9; s++) await b.at(s);
  assert.equal(b.screen(), 'portrait');
  assert.equal(b.mpv.props['video-rotate'], config.box.rotate);
});

test('a tilt switch that flickers while the TV turns is ignored until it settles', async () => {
  const b = tiltBox();
  for (let s = 0; s <= 3; s++) await b.at(s);
  b.switchTo('open');
  await b.at(4);
  b.switchTo('closed');
  for (let s = 5; s <= 9; s++) await b.at(s);
  assert.ok(!((ROOT + '/screen.json') in b.files), 'nothing saved');
  assert.equal(b.mpv.props['video-rotate'], undefined, 'not turned');
});

test('the website\'s choice stays until the tilt switch moves', async () => {
  const b = tiltBox();
  for (let s = 0; s <= 3; s++) await b.at(s);
  b.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'landscape' }); // Landscape tapped
  for (let s = 4; s <= 10; s++) await b.at(s);
  assert.equal(b.screen(), 'landscape', 'the switch, still closed, leaves it');
  b.switchTo('open');
  for (let s = 11; s <= 13; s++) await b.at(s);
  b.switchTo('closed');
  for (let s = 14; s <= 16; s++) await b.at(s);
  assert.equal(b.screen(), 'portrait', 'it follows the switch once it moves');
});

test('a box with no tilt switch set never reads one', async () => {
  let reads = 0;
  const noSwitch = Object.assign({}, config, { box: Object.assign({}, config.box, { tiltSwitch: null }) });
  const b = box({ photos: ['00001-a.jpg'] }, { config: noSwitch, readTilt: async () => { reads++; return 'open'; } });
  for (let s = 0; s < 5; s++) await b.tick();
  assert.equal(reads, 0);
});

test('a tilt switch that can\'t be read is logged once', async () => {
  const withSwitch = Object.assign({}, config, { box: Object.assign({}, config.box, { tiltSwitch: { gpio: 17, closed: 'portrait' } }) });
  const b = box({ photos: ['00001-a.jpg'] }, { config: withSwitch, readTilt: async () => { throw new Error('spawn gpioget ENOENT'); } });
  for (let s = 0; s < 5; s++) { b.now = new Date(+at(10, 20, 18) + s * 1000); await b.tick(); }
  const warnings = b.logs.filter((l) => l.startsWith("WARNING: Couldn't read the tilt switch on GPIO17: "));
  assert.equal(warnings.length, 1, b.logs.join('\n'));
  assert.ok(!((ROOT + '/screen.json') in b.files));
});

// The box playing Photos, with its website wired to it as on the box.
async function photosPlaying() {
  const b = box({ photos: ['00001-a.jpg', '00002-b.mp4', '00003-c.png'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
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

// The box playing the tag favorites: uploads a, b, c, tagged favorites as given.
async function favoritesPlaying(tagged) {
  const b = box({ photos: ['00001-a.jpg', '00002-b.jpg', '00003-c.jpg'] });
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['favorites'], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
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
  const none = 'Nothing tagged favorites yet. Showing black until something is.';
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

// ---- The address code ----

// A box playing the uploads a and b, at the address `b.address` (null: none).
// The codes it makes are listed in `b.made`.
async function codeBox(more = {}, photos = ['00001-a.jpg', '00002-b.jpg']) {
  const state = { address: '10.0.0.25' };
  const made = [];
  const b = box({ photos }, Object.assign({
    readAddress: () => state.address,
    makeAddressCode: async (url, maxSize) => { made.push([url, maxSize]); return { size: 116, stride: 464, pixels: Buffer.from(url) }; },
  }, more));
  b.made = made;
  b.setAddress = (a) => { state.address = a; };
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: ['upload'], filters: [], setAt: +at(10, 20, 17), expires: null, untilCleared: true });
  b.later = (seconds) => { b.now = new Date(b.now.getTime() + seconds * 1000); };
  b.overlay = () => b.mpv.overlays[1] || null;
  b.state = () => JSON.parse(b.files['/run/tvbox/address-code.json'] || 'null');
  return b;
}

test('the address code shows for 3 seconds when an item starts', async () => {
  const b = await codeBox();
  await b.tick(); // a starts
  assert.deepEqual(b.made, [['http://10.0.0.25/', 120]]);
  assert.equal(b.files['/run/tvbox/address-code.bgra'].toString(), 'http://10.0.0.25/');
  // Portrait (turned 270): the viewer's bottom-right is the panel's top-right.
  assert.deepEqual(b.overlay(), [1920 - 116 - 24, 24, '/run/tvbox/address-code.bgra', 0, 'bgra', 116, 116, 464]);
  assert.deepEqual(b.state(), { showing: true, x: 1780, y: 24, size: 116, width: 1920, height: 1080, url: 'http://10.0.0.25/' });
  for (const s of [1, 1]) { b.later(s); await b.tick(); assert.ok(b.overlay(), 'still up after ' + s); }
  b.later(1); // 3 seconds
  await b.tick();
  assert.equal(b.overlay(), null);
  assert.equal(b.state().showing, false);
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg', 'a is still on screen');
  b.mpv.finish(); // b starts
  await b.tick();
  assert.ok(b.overlay(), 'drawn again for b');
  assert.equal(b.made.length, 1, 'the same address: the code is not made again');
  assert.equal(b.logs.filter((l) => l === 'Address code: http://10.0.0.25/').length, 1, b.logs.join('\n'));
});

test('the address code follows a new address', async () => {
  const b = await codeBox();
  await b.tick();
  b.setAddress('10.0.0.31');
  b.mpv.finish();
  await b.tick();
  assert.deepEqual(b.made.map((m) => m[0]), ['http://10.0.0.25/', 'http://10.0.0.31/']);
  assert.equal(b.files['/run/tvbox/address-code.bgra'].toString(), 'http://10.0.0.31/');
  assert.equal(b.state().url, 'http://10.0.0.31/');
});

test('no address code without an address or when switched off', async () => {
  const b = await codeBox();
  b.setAddress(null);
  await b.tick();
  assert.equal(b.overlay(), null);
  assert.deepEqual(b.made, []);
  b.setAddress('10.0.0.25');
  b.files[ROOT + '/address-code.json'] = JSON.stringify({ show: false });
  b.mpv.finish();
  await b.tick();
  assert.equal(b.overlay(), null);
  // Switched back on: from the next item.
  b.files[ROOT + '/address-code.json'] = JSON.stringify({ show: true });
  b.mpv.finish();
  await b.tick();
  assert.ok(b.overlay());
  // Switched off while up: taken away at the next tick.
  b.files[ROOT + '/address-code.json'] = JSON.stringify({ show: false });
  await b.tick();
  assert.equal(b.overlay(), null);
  // qrencode missing: no code, and a warning once.
  const c = await codeBox({ makeAddressCode: async () => { throw new Error('spawn qrencode ENOENT'); } });
  await c.tick();
  c.mpv.finish();
  await c.tick();
  assert.equal(c.overlay(), null);
  assert.equal(c.logs.filter((l) => l === "WARNING: Couldn't make the address code: spawn qrencode ENOENT").length, 1, c.logs.join('\n'));
});

test('no address code on a black screen', async () => {
  const b = await codeBox();
  await b.tick();
  assert.ok(b.overlay());
  b.files[ROOT + '/override.json'] = JSON.stringify({ tags: null, filters: [], setAt: +b.now, expires: null, untilCleared: true });
  await b.tick();
  assert.equal(b.mpv.playing(), null);
  assert.equal(b.overlay(), null);
  assert.equal(b.state().showing, false);
  // Turning the TV takes it away too (its corner moves); the next item shows it in the new one.
  const c = await codeBox();
  await c.tick();
  c.files[ROOT + '/screen.json'] = JSON.stringify({ orientation: 'landscape' });
  c.files[ROOT + '/tags.json'] = JSON.stringify({ tags: { 'photos/00001-a.jpg': ['landscape'], 'photos/00002-b.jpg': ['landscape'] } });
  await c.tick();
  c.mpv.finish();
  await c.tick();
  assert.deepEqual(c.overlay().slice(0, 2), [1920 - 116 - 24, 1080 - 116 - 24], 'landscape (turned 0): the panel\'s bottom-right');
});

// Ticks once a second for `seconds`, noting the seconds (from now) at which the code is up.
async function codeUpTimes(b, seconds) {
  const up = [];
  for (let s = 1; s <= seconds; s++) { b.later(1); await b.tick(); if (b.overlay()) up.push(s); }
  return up;
}

test('the address code shows again every 10 seconds while one item stays on screen', async () => {
  const b = await codeBox({}, ['00001-a.jpg']);
  await b.tick(); // a starts, and stays
  assert.ok(b.overlay(), 'drawn when a starts');
  const up = await codeUpTimes(b, 23);
  assert.deepEqual(up, [1, 2, 10, 11, 12, 20, 21, 22]);
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg', 'a is still on screen');
  assert.equal(b.made.length, 1, 'the code is made once');
});

test('a new item starts the 10 seconds again', async () => {
  const b = await codeBox();
  await b.tick(); // a starts at 0
  for (let s = 0; s < 6; s++) { b.later(1); await b.tick(); }
  b.mpv.finish(); // b starts at 6
  await b.tick();
  assert.ok(b.overlay(), 'drawn when b starts');
  // Seconds after b started: up for 3, then not at 4 (10 after a), then again at 10.
  assert.deepEqual(await codeUpTimes(b, 12), [1, 2, 10, 11, 12]);
});

test('no repeated address code when switched off', async () => {
  const b = await codeBox({}, ['00001-a.jpg']);
  b.files[ROOT + '/address-code.json'] = JSON.stringify({ show: false });
  await b.tick();
  assert.deepEqual(await codeUpTimes(b, 12), []);
  b.files[ROOT + '/address-code.json'] = JSON.stringify({ show: true });
  const up = await codeUpTimes(b, 10);
  assert.ok(up.length > 0 && up[0] <= 10, 'drawn within 10 seconds: ' + up);
  assert.equal(b.mpv.playing(), ROOT + '/photos/00001-a.jpg', 'a is still on screen');
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
