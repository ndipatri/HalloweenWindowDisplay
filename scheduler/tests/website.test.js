// Tests for the box's website (scheduler/website.js), run with Node:
//   node scheduler/tests/website.test.js
// The handler is called directly, with fake files and a fixed time.
'use strict';
const assert = require('assert');
const config = require('../config.js');
const { createWebsite } = require('../website.js');

const ROOT = '/home/test/video-scheduler';
const OVERRIDE = ROOT + '/override.json';
const SIX_PM = new Date(2026, 9, 20, 18, 0);

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// A website with fake files. `dirs` maps folder paths (relative to the
// video folder) to the names in them.
function site(dirs = {}, extra = {}) {
  const files = {};
  const folders = { [ROOT]: [] };
  for (const [k, v] of Object.entries(dirs)) {
    folders[ROOT + '/' + k] = v;
    if (!k.includes('/')) folders[ROOT].push(k);
  }
  const sync = { running: false, started: 0 };
  const w = createWebsite({
    config,
    videoRoot: ROOT,
    now: () => SIX_PM,
    readText: (p) => (p in files ? files[p] : null),
    readTail: (p, bytes) => (p in files ? files[p].slice(-bytes) : null),
    startSync: () => {
      if (sync.running) return false;
      sync.running = true;
      sync.started++;
      return true;
    },
    writeText: (p, text) => { files[p] = text; },
    removeFile: (p) => { delete files[p]; },
    listFolder: (p) => (p in folders ? folders[p].slice() : null),
    log: extra.log,
    picksChanged: extra.picksChanged,
  });
  const call = async (method, path, body, headers = {}) => {
    const r = await w.handle({ method, path, headers, body: body === undefined ? '' : JSON.stringify(body) });
    return Object.assign({}, r, { json: r.type === 'application/json' ? JSON.parse(r.body) : null });
  };
  const override = () => (OVERRIDE in files ? JSON.parse(files[OVERRIDE]) : null);
  return { files, call, override, sync };
}

const show = (s, body) => s.call('POST', '/api/show', body);

// The page's own script must compile, or none of its buttons work.
function assertScriptCompiles(page) {
  for (const part of page.split('<script>').slice(1)) new (require('vm').Script)(part.split('</script>')[0]);
}

// ---- Shows the status ----

test('the website shows what is on screen now', async () => {
  const s = site();
  s.files[ROOT + '/status'] = 'halloween/kid (scheduled until 7:30 PM)\n';
  const r = await s.call('GET', '/api/status');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'halloween/kid (scheduled until 7:30 PM)');
});

test('the website says when the box has not started yet', async () => {
  const s = site();
  const r = await s.call('GET', '/api/status');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, null);
  assert.ok((await s.call('GET', '/')).body.includes("r.status || 'The box has not started yet.'"));
});

// ---- Overrides for a while ----

test('the website plays a playlist until the schedule changes', async () => {
  const s = site();
  const r = await show(s, { target: 'grownup', until: 'schedule' });
  assert.equal(r.status, 200);
  assert.deepEqual(s.override(), { playlist: 'grownup', setAt: +SIX_PM, expires: null, untilCleared: false });
  assert.equal(r.json.message, 'Showing grownup until the schedule next changes.');
});

test('the website plays a playlist for a number of minutes', async () => {
  const s = site();
  const r = await show(s, { target: 'kid', until: 30 });
  assert.equal(r.status, 200);
  assert.equal(s.override().playlist, 'kid');
  assert.equal(s.override().expires, +SIX_PM + 30 * 60 * 1000);
  assert.equal(s.override().untilCleared, false);
  assert.equal(r.json.message, 'Showing kid until 6:30 PM, then back to the schedule.');
});

test('the website plays a playlist until switched back', async () => {
  const s = site();
  const r = await show(s, { target: 'grownup', until: 'cleared' });
  assert.equal(s.override().playlist, 'grownup');
  assert.equal(s.override().untilCleared, true);
  assert.equal(s.override().expires, null);
  assert.equal(r.json.message, 'Showing grownup until you choose Back to schedule.');
});

test('the website turns the screen black', async () => {
  const s = site();
  const r = await show(s, { target: 'black', until: 'schedule' });
  assert.equal(s.override().playlist, null);
  assert.equal(r.json.message, 'Showing black until the schedule next changes.');
});

test('the website previews another season', async () => {
  const s = site({ christmas: ['kid'], 'christmas/kid': [] });
  const r = await show(s, { target: 'christmas/kid', until: 5 });
  assert.equal(r.status, 200, r.body);
  assert.equal(s.override().playlist, 'christmas/kid');
});

// ---- Back to the schedule ----

test('the website goes back to the schedule', async () => {
  const s = site();
  s.files[OVERRIDE] = JSON.stringify({ playlist: 'grownup', setAt: +SIX_PM, expires: null, untilCleared: true });
  const r = await s.call('POST', '/api/schedule');
  assert.equal(r.status, 200);
  assert.equal(s.override(), null);
  assert.equal(r.json.message, 'Override cancelled. Following the schedule.');
});

// ---- Refuses bad choices ----

test("the website refuses a name that isn't a playlist", async () => {
  const s = site();
  for (const target of ['../x', 'a/b/c', '.hidden']) {
    const r = await show(s, { target, until: 'schedule' });
    assert.equal(r.status, 400, target);
    assert.ok(r.json.error.startsWith('Not a playlist name'), r.json.error);
  }
  assert.equal(s.override(), null);
});

test('the website refuses a season that has no folder', async () => {
  const s = site();
  const r = await show(s, { target: 'easter/kid', until: 'schedule' });
  assert.equal(r.status, 400);
  assert.ok(r.json.error.startsWith('No easter folder on the box'), r.json.error);
  assert.equal(s.override(), null);
});

test("the website refuses minutes that aren't a whole number above zero", async () => {
  const s = site();
  for (const until of [0, -5, 2.5, 'soon']) {
    const r = await show(s, { target: 'kid', until });
    assert.equal(r.status, 400, String(until));
    assert.ok(r.json.error.startsWith('Not a number of minutes'), r.json.error);
  }
  assert.equal(s.override(), null);
});

// ---- Lists the choices ----

test('the website lists what it can show', async () => {
  const s = site({ halloween: ['grownup', 'fuzzy.mp4'], 'halloween/grownup': [], thanksgiving: [] });
  const r = await s.call('GET', '/api/choices');
  assert.deepEqual(r.json.playlists, ['kid', 'grownup']);
  assert.deepEqual(r.json.previews, ['halloween', 'halloween/grownup', 'thanksgiving']);
});

test('the page starts For how long on until switched back', async () => {
  const page = (await site().call('GET', '/')).body;
  const select = page.slice(page.indexOf('<select id="until">'), page.indexOf('</select>', page.indexOf('<select id="until">')));
  const chosen = select.split('<option').filter((o) => /\sselected[\s>]/.test(o.split('>')[0] + '>'));
  assert.equal(chosen.length, 1, 'one option chosen: ' + select);
  assert.ok(chosen[0].includes('value="cleared"'), chosen[0]);
  for (const v of ['schedule', '15', '30', '60']) assert.ok(select.includes('value="' + v + '"'), 'still offers ' + v);
});

test('the website page offers each choice', async () => {
  const s = site();
  const r = await s.call('GET', '/');
  assert.equal(r.status, 200);
  assert.equal(r.type, 'text/html');
  for (const text of ['>Black<', '>Back to schedule<',
    'value="schedule"', 'value="15"', 'value="30"', 'value="60"', 'value="cleared"']) {
    assert.ok(r.body.includes(text), 'page has ' + text);
  }
  assertScriptCompiles(r.body);
});

// ---- Syncs on request ----

test('the website starts a sync when asked', async () => {
  const s = site();
  const r = await s.call('POST', '/api/sync');
  assert.equal(r.status, 200);
  assert.equal(s.sync.started, 1);
  assert.equal(r.json.message, 'Checking GitHub for new videos. New ones play within a minute or two; watch Recent activity below.');
});

test("the website doesn't start a second sync while one is running", async () => {
  const s = site();
  s.sync.running = true;
  const r = await s.call('POST', '/api/sync');
  assert.equal(r.status, 200);
  assert.equal(s.sync.started, 0);
  assert.equal(r.json.message, 'Already checking for new videos.');
});

// ---- Shows recent activity ----

test('the website shows the last lines of the log', async () => {
  const s = site();
  const lines = Array.from({ length: 30 }, (_, i) => 'line ' + (i + 1));
  s.files[ROOT + '/scheduler.log'] = lines.join('\n') + '\n';
  const r = await s.call('GET', '/api/log');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.lines, lines.slice(10));
});

test('the website shows no log lines when there is no log yet', async () => {
  const s = site();
  const r = await s.call('GET', '/api/log');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.lines, []);
});

test('the website page offers checking for new videos and shows recent activity', async () => {
  const s = site();
  const page = (await s.call('GET', '/')).body;
  assert.ok(!page.includes('Sync now'), 'the old wording is gone');
  for (const text of ['<h2>New videos from GitHub</h2>', 'The box checks GitHub for new videos every hour by itself.',
    'id="sync">Check for new videos now<', 'id="sync-note"', "setText($('sync-note')", 'Recent activity', 'id="log"', "fetch('/api/log')", "post('/api/sync', {}, true)"]) {
    assert.ok(page.includes(text), 'page has ' + text);
  }
  assertScriptCompiles(page);
});

// ---- Photos (choices and page) ----

test('the website offers All uploads and My picks apart from the season previews', async () => {
  const s = site({ halloween: [], photos: ['old'], 'photos/old': [], picks: [] });
  const r = await s.call('GET', '/api/choices');
  assert.equal(r.json.photos, true);
  assert.equal(r.json.picks, true);
  assert.deepEqual(r.json.previews, ['halloween']);
});

test('the website page offers All uploads and My picks buttons', async () => {
  const s = site();
  const page = (await s.call('GET', '/')).body;
  assert.ok(/id="photos"[^>]*>All uploads</.test(page), 'page has an All uploads button');
  assert.ok(page.includes("$('photos').onclick = () => show('photos')"), 'it shows photos for the chosen duration');
  assert.ok(/id="picks"[^>]*>My picks</.test(page), 'page has a My picks button');
  assert.ok(page.includes("$('picks').onclick = () => show('picks')"), 'it shows picks for the chosen duration');
  assert.ok(!page.includes('>Photos<'), 'no button is still called Photos');
  assertScriptCompiles(page);
});

// ---- My picks ----

const PICKS = ROOT + '/picks.json';
const picksFile = (...picks) => JSON.stringify({ picks }) + '\n';
const savedPicks = (files) => JSON.parse(files[PICKS]).picks;

test('the website lists what can be picked', async () => {
  const s = site({
    halloween: ['fuzzy.mp4', 'poster.jpg', 'grownup'], 'halloween/grownup': ['jump.mp4'],
    thanksgiving: ['dusk.mp4'], photos: ['00001-a.jpg', '00002-b.mov'],
  });
  s.files[PICKS] = picksFile('thanksgiving/dusk.mp4', 'photos/00001-a.jpg');
  const r = await s.call('GET', '/api/picks');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(r.json.items, [
    { path: 'halloween/fuzzy.mp4', group: 'Halloween' },
    { path: 'halloween/grownup/jump.mp4', group: 'Halloween / Grownup' },
    { path: 'thanksgiving/dusk.mp4', group: 'Thanksgiving' },
    { path: 'photos/00001-a.jpg', group: 'Uploads' },
    { path: 'photos/00002-b.mov', group: 'Uploads' },
  ]);
  assert.deepEqual(r.json.picks, ['thanksgiving/dusk.mp4', 'photos/00001-a.jpg']);
});

test('the website leaves out a pick that is no longer on the box', async () => {
  const s = site({ thanksgiving: ['dusk.mp4'] });
  s.files[PICKS] = picksFile('halloween/gone.mp4', 'thanksgiving/dusk.mp4');
  const r = await s.call('GET', '/api/picks');
  assert.deepEqual(r.json && r.json.picks, ['thanksgiving/dusk.mp4']);
});

test('the website saves the picks in the order given', async () => {
  const logs = [];
  let changed = 0;
  const s = site({ halloween: ['fuzzy.mp4'], thanksgiving: ['dusk.mp4'], photos: ['00001-a.jpg'] },
    { log: (m) => logs.push(m), picksChanged: async () => { changed++; } });
  const r = await s.call('POST', '/api/picks', { picks: ['photos/00001-a.jpg', 'thanksgiving/dusk.mp4'] });
  assert.equal(r.status, 200, r.body);
  assert.equal(changed, 1, 'the player is told the picks changed');
  assert.deepEqual(r.json.picks, ['photos/00001-a.jpg', 'thanksgiving/dusk.mp4']);
  assert.deepEqual(savedPicks(s.files), ['photos/00001-a.jpg', 'thanksgiving/dusk.mp4']);
  assert.equal(r.json.message, 'Saved. 2 picked.');
  assert.ok(logs.includes('My picks: 2 picked (from the website).'), logs.join('\n'));
});

test('the website saves each pick only once', async () => {
  const s = site({ halloween: ['fuzzy.mp4'], thanksgiving: ['dusk.mp4'] });
  const r = await s.call('POST', '/api/picks', { picks: ['thanksgiving/dusk.mp4', 'halloween/fuzzy.mp4', 'thanksgiving/dusk.mp4'] });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(savedPicks(s.files), ['thanksgiving/dusk.mp4', 'halloween/fuzzy.mp4']);
  assert.equal(r.json.message, 'Saved. 2 picked.');
});

test('the website saves an empty list of picks', async () => {
  const s = site({ thanksgiving: ['dusk.mp4'] });
  s.files[PICKS] = picksFile('thanksgiving/dusk.mp4');
  const r = await s.call('POST', '/api/picks', { picks: [] });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(savedPicks(s.files), []);
  assert.equal(r.json.message, 'Saved. Nothing picked.');
});

test("the website refuses a pick that can't be picked", async () => {
  const s = site({ halloween: ['fuzzy.mp4', 'poster.jpg'], photos: ['.upload-1'] });
  s.files[ROOT + '/status'] = 'halloween/kid\n';
  s.files[PICKS] = picksFile('halloween/fuzzy.mp4');
  for (const bad of ['../status', 'halloween/poster.jpg', 'halloween/missing.mp4', 'photos/.upload-1', 'photos/sub/x.jpg', 'picks/x.mp4', 'halloween\\fuzzy.mp4']) {
    const r = await s.call('POST', '/api/picks', { picks: [bad] });
    assert.equal(r.status, 400, bad + ': ' + r.body);
    assert.ok(r.json.error.startsWith("Can't pick") && r.json.error.includes(bad), r.json.error);
  }
  // A good pick with a bad one saves neither.
  const mixed = await s.call('POST', '/api/picks', { picks: ['halloween/fuzzy.mp4', 'halloween/poster.jpg'] });
  assert.equal(mixed.status, 400, mixed.body);
  assert.equal((await s.call('POST', '/api/picks', { picks: 'halloween/fuzzy.mp4' })).status, 400);
  assert.deepEqual(savedPicks(s.files), ['halloween/fuzzy.mp4']);
});

test('a picks file that is broken reads as nothing picked', async () => {
  const s = site({ thanksgiving: ['dusk.mp4'] });
  for (const text of ['{not json', '{"picks":"thanksgiving/dusk.mp4"}', '[1,2]', '{"picks":[7,null,"thanksgiving/dusk.mp4"]}']) {
    s.files[PICKS] = text;
    const r = await s.call('GET', '/api/picks');
    assert.deepEqual(r.json.picks, text.includes('[7') ? ['thanksgiving/dusk.mp4'] : [], text);
  }
});

test("a problem rebuilding the queue doesn't undo a save", async () => {
  const logs = [];
  const s = site({ thanksgiving: ['dusk.mp4'] },
    { log: (m) => logs.push(m), picksChanged: async () => { throw new Error('mpv went away'); } });
  const r = await s.call('POST', '/api/picks', { picks: ['thanksgiving/dusk.mp4'] });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(savedPicks(s.files), ['thanksgiving/dusk.mp4']);
  assert.ok(logs.some((l) => l.startsWith('ERROR:') && l.includes('mpv went away')), logs.join('\n'));
});

test('the website refuses My picks while nothing is picked', async () => {
  const s = site({ thanksgiving: ['dusk.mp4'] });
  for (const picks of [null, ['halloween/gone.mp4']]) {
    if (picks) s.files[PICKS] = picksFile(...picks);
    const r = await show(s, { target: 'picks', until: 'cleared' });
    assert.equal(r.status, 400, r.body);
    assert.equal(r.json.error, 'Nothing is picked yet. Tick something under My picks first.');
    assert.equal(s.override(), null);
  }
});

test("the website won't show a folder inside picks", async () => {
  const s = site({ picks: ['old'], 'picks/old': [] });
  const r = await show(s, { target: 'picks/old' });
  assert.equal(r.status, 400, r.body);
  assert.ok(r.json.error.startsWith('Not a playlist name'), r.json.error);
  assert.equal(s.override(), null);
});

test('the website page offers My picks', async () => {
  const s = site();
  const page = (await s.call('GET', '/')).body;
  for (const text of ['<h2>My picks</h2>', 'id="picklist"', "fetch('/api/picks')", 'type="checkbox"', "fetch('/api/picks', { method: 'POST'", 'togglePick(']) {
    assert.ok(page.includes(text), 'page has ' + text);
  }
  assertScriptCompiles(page);
});

test('the page confirms the picks next to the list', async () => {
  const page = (await site().call('GET', '/')).body;
  const section = page.slice(page.indexOf('<h2>My picks</h2>'), page.indexOf('<h2>Preview a season</h2>'));
  assert.ok(section.includes('Each tick is saved straight away.'), 'the section says ticks are saved');
  assert.ok(section.indexOf('id="picklist"') < section.indexOf('id="picknote"'), 'the note is under the list');
  assert.ok(section.includes('id="picknote" role="status" aria-live="polite"'), 'a screen reader reads the note out');
  for (const text of ["'Saving…'", "'✓ Saved. '", "'Tap My picks under Play to show them.'", "'Showing on the window now.'", "'Nothing picked yet.'"]) {
    assert.ok(page.includes(text), 'the note can say ' + text);
  }
  assert.ok(!section.includes('<button'), 'the section has no play button of its own');
  assert.ok(!page.includes('play-picks'), 'nothing is left of the Play my picks button');
  assert.ok(/button:active/.test(page), 'buttons look pressed when tapped');
  assert.ok(/\.pickbar \{[^}]*position: sticky/.test(page), 'the note stays in view');
  assertScriptCompiles(page);
});

// ---- The page shows what is playing under Play ----

test('the page shows the status under Play and outlines what is playing', async () => {
  const page = (await site().call('GET', '/')).body;
  const body = page.slice(page.indexOf('<main>'));
  const play = body.indexOf('<h2>Play</h2>');
  assert.ok(play !== -1 && body.indexOf('id="status"') > play && body.indexOf('id="status"') < body.indexOf('id="playlists"'),
    'the status line is in the Play section, before its buttons');
  assert.ok(!body.slice(0, play).includes('class="card"'), 'no separate status card above Play');
  for (const choice of ['picks', 'photos', 'black']) {
    assert.ok(page.includes('data-choice="' + choice + '"'), 'the ' + choice + ' button can be outlined');
  }
  assert.ok(/button\.current \{[^}]*outline/.test(page), 'the playing button is outlined');
  assert.ok(page.includes("setAttribute('aria-current', 'true')"), 'and marked as current');
  const refresh = page.slice(page.indexOf('async function refresh()'), page.indexOf('let playlistNames'));
  assert.ok(refresh.includes('playingChoice('), 'the outline follows the status');
  assertScriptCompiles(page);
});

test('the page works out which Play button is playing from the status', async () => {
  const page = (await site().call('GET', '/')).body;
  const code = page.split('<script>').map((p) => p.split('</script>')[0]).find((p) => p.includes('function playingChoice'));
  assert.ok(code, 'the page has playingChoice');
  const context = {};
  require('vm').runInNewContext(code + '\nthis.playingChoice = playingChoice;', context);
  const playlists = ['kid', 'grownup'];
  const cases = [
    ['thanksgiving/kid (scheduled until 7:30 PM)', 'kid'],
    ['halloween/grownup (override until cleared)', 'grownup'],
    ['kid (scheduled until 7:00 AM)', 'kid'],
    ['picks (override until cleared)', 'picks'],
    ['photos (override until 8:15 PM, then back to the schedule)', 'photos'],
    ['black (outside schedule until 5:00 PM)', 'black'],
    ['black (no season today, Nov 2)', 'black'],
    ['black (waiting for the clock to be set)', 'black'],
    ['kid (override until cleared)', 'kid'],
    ['black (override until cleared; asked for kid but no season today)', 'black'],
    ['halloween/scary (override until cleared)', null],
    ['thanksgiving (override until cleared)', null],
    ['', null],
    [null, null],
  ];
  for (const [status, choice] of cases) assert.equal(context.playingChoice(status, playlists), choice, status);
});

test('the page puts a ticked item at the end of the picks and closes up an unticked one', async () => {
  const page = (await site().call('GET', '/')).body;
  const code = page.split('<script>').map((p) => p.split('</script>')[0]).find((p) => p.includes('function togglePick'));
  assert.ok(code, 'the page has togglePick');
  const context = {};
  require('vm').runInNewContext(code + '\nthis.togglePick = togglePick;', context);
  const first = context.togglePick(['thanksgiving/dusk.mp4', 'photos/00001-a.jpg', 'halloween/fuzzy.mp4'], 'halloween/grownup/jump.mp4');
  assert.deepEqual(Array.from(first), ['thanksgiving/dusk.mp4', 'photos/00001-a.jpg', 'halloween/fuzzy.mp4', 'halloween/grownup/jump.mp4']);
  const second = context.togglePick(first, 'photos/00001-a.jpg');
  assert.deepEqual(Array.from(second), ['thanksgiving/dusk.mp4', 'halloween/fuzzy.mp4', 'halloween/grownup/jump.mp4']);
});

// ---- Uploads ----
// Against a real temporary video folder, as uploads are streamed to disk.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { realIo } = require('../player.js');

const MB = 1024 * 1024;
const GB = 1024 * MB;

function uploads({ pin = '4321', free = 20 * GB } = {}) {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-test-')), 'video-scheduler');
  fs.mkdirSync(root);
  if (pin !== null) fs.writeFileSync(root + '/upload-pin', pin + '\n');
  const u = { root, logs: [], removed: [], now: new Date(2026, 10, 4, 18, 0), free };
  u.w = createWebsite(Object.assign(realIo(), {
    config,
    videoRoot: root,
    now: () => u.now,
    freeBytes: () => u.free,
    log: (m) => u.logs.push(m),
    // Taken off mpv while the file is still there.
    beforeRemove: async (p) => { assert.ok(fs.existsSync(p), 'removed before mpv let go'); u.removed.push(p); },
    picksChanged: async () => { u.picksChanged = (u.picksChanged || 0) + 1; },
    startSync: () => true,
  }));
  const answer = (r) => Object.assign({}, r, { json: r.type === 'application/json' ? JSON.parse(r.body) : null });
  // Sends `name` with `bytes` (a number of bytes, or a Buffer).
  u.upload = async (name, bytes = 1000, pin = '4321') => {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.alloc(bytes, 7);
    return answer(await u.w.receiveUpload({ name, pin, length: data.length, stream: Readable.from([data]) }));
  };
  // Declares `length` bytes, but a body that must never be read.
  u.declare = async (name, length, pin = '4321') => {
    u.bodyRead = false;
    const stream = new Readable({ read() { u.bodyRead = true; this.push(null); } });
    return answer(await u.w.receiveUpload({ name, pin, length, stream }));
  };
  u.call = async (method, p, body, pin) => answer(await u.w.handle({
    method, path: p, headers: pin === undefined ? {} : { 'x-upload-pin': pin },
    body: body === undefined ? '' : JSON.stringify(body),
  }));
  // Everything in photos/, hidden part files included, but not the counter.
  u.photos = () => (fs.existsSync(root + '/photos')
    ? fs.readdirSync(root + '/photos').filter((n) => n !== '.last-number').sort() : []);
  u.put = (name, bytes) => {
    fs.mkdirSync(root + '/photos', { recursive: true });
    fs.writeFileSync(root + '/photos/' + name, Buffer.alloc(bytes || 1, 1));
  };
  return u;
}

test('the website adds a photo with the right PIN', async () => {
  const u = uploads();
  const data = Buffer.alloc(2 * MB, 9);
  const r = await u.upload('IMG_1234.JPG', data);
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(u.photos(), ['00001-img_1234.jpg']);
  assert.ok(fs.readFileSync(u.root + '/photos/00001-img_1234.jpg').equals(data));
  assert.equal(r.json.message, 'Added IMG_1234.JPG.');
  assert.ok(u.logs.includes('Uploaded photos/00001-img_1234.jpg (2.0 MB)'), u.logs.join('\n'));
});

test('the website refuses an upload with the wrong PIN', async () => {
  const u = uploads();
  const r = await u.upload('IMG_1234.JPG', 1000, '1111');
  assert.equal(r.json && r.json.error, 'Wrong PIN.');
  assert.deepEqual(u.photos(), []);
});

test('the website refuses an upload with no PIN', async () => {
  const u = uploads();
  const data = Buffer.alloc(1000);
  const r = await u.w.receiveUpload({ name: 'IMG_1234.JPG', pin: undefined, length: data.length, stream: Readable.from([data]) });
  assert.equal(JSON.parse(r.body).error, 'Wrong PIN.');
  assert.deepEqual(u.photos(), []);
});

test('the website refuses uploads while no PIN is set', async () => {
  const u = uploads({ pin: null });
  const r = await u.upload('IMG_1234.JPG', 1000, '4321');
  assert.equal(r.json && r.json.error, 'Adding photos is off: no upload PIN is set on the box.');
  assert.deepEqual(u.photos(), []);
});

test("a PIN file that isn't 4 to 8 digits leaves uploads off", async () => {
  const u = uploads({ pin: '12' });
  const r = await u.upload('IMG_1234.JPG', 1000, '12');
  assert.equal(r.json && r.json.error, 'Adding photos is off: no upload PIN is set on the box.');
  assert.deepEqual(u.photos(), []);
});

test('five wrong PINs in a row lock uploads for five minutes', async () => {
  const u = uploads();
  for (let i = 0; i < 5; i++) await u.upload('a.jpg', 10, '1111');
  u.now = new Date(2026, 10, 4, 18, 1);
  const locked = await u.upload('a.jpg', 10, '4321');
  assert.equal(locked.json && locked.json.error, 'Too many wrong PINs. Try again after 6:05 PM.');
  assert.equal(u.logs.filter((l) => l === 'Five wrong upload PINs in a row: uploads locked until 6:05 PM').length, 1, u.logs.join('\n'));
  u.now = new Date(2026, 10, 4, 18, 5);
  const r = await u.upload('a.jpg', 10, '4321');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(u.photos(), ['00001-a.jpg']);
});

test('a right PIN starts the count of wrong PINs again', async () => {
  const u = uploads();
  for (let i = 0; i < 4; i++) await u.upload('x.jpg', 10, '1111');
  assert.equal((await u.upload('a.jpg', 10, '4321')).status, 200);
  for (let i = 0; i < 4; i++) await u.upload('x.jpg', 10, '1111');
  assert.equal((await u.upload('b.jpg', 10, '4321')).status, 200);
  assert.deepEqual(u.photos(), ['00001-a.jpg', '00002-b.jpg']);
});

test('uploads are numbered in the order they arrived', async () => {
  const u = uploads();
  await u.upload('IMG_1.JPG');
  await u.upload('IMG_1.JPG');
  await u.upload('Beach Day!!.mov');
  assert.deepEqual(u.photos(), ['00001-img_1.jpg', '00002-img_1.jpg', '00003-beach-day.mov']);
  const r = await u.call('GET', '/api/uploads');
  assert.deepEqual(r.json.uploads.map((x) => x.name), ['00001-img_1.jpg', '00002-img_1.jpg', '00003-beach-day.mov']);
});

test('numbering carries on after the highest upload', async () => {
  const u = uploads();
  u.put('00002-a.jpg');
  u.put('00007-b.jpg');
  const r = await u.upload('c.jpg');
  assert.equal(r.status, 200, r.body);
  assert.ok(u.photos().includes('00008-c.jpg'), u.photos().join(' '));
});

test('a name with nothing usable left is called upload', async () => {
  const u = uploads();
  await u.upload('写真.jpg');
  assert.deepEqual(u.photos(), ['00001-upload.jpg']);
});

test("the website refuses a file that isn't a photo or video it can show", async () => {
  const u = uploads();
  for (const name of ['notes.txt', 'IMG_1.HEIC', 'noextension']) {
    const r = await u.upload(name);
    assert.equal(r.json && r.json.error, 'Only JPEG or PNG photos and MP4, MOV or M4V videos can be added.', name);
  }
  assert.deepEqual(u.photos(), []);
});

test('the website refuses a file over 1 GB', async () => {
  const u = uploads();
  const r = await u.declare('long.mov', GB + 1);
  assert.equal(r.json && r.json.error, 'Too big: one file can be at most 1 GB.');
  assert.deepEqual(u.photos(), []);
  assert.equal(u.bodyRead, false);
});

test('the website refuses an upload that would leave under 2 GB free', async () => {
  const u = uploads({ free: 2.5 * GB });
  const r = await u.declare('clip.mov', 600 * MB);
  assert.equal(r.json && r.json.error, 'Not enough room on the box for clip.mov: 2 GB must stay free.');
  assert.deepEqual(u.photos(), []);
  assert.equal(u.bodyRead, false);
});

test('an upload that stops partway leaves nothing behind', async () => {
  const u = uploads();
  const stream = new Readable({ read() {} });
  const done = u.w.receiveUpload({ name: 'clip.mov', pin: '4321', length: 10 * MB, stream });
  stream.push(Buffer.alloc(5 * MB, 3));
  stream.push(null);
  await done;
  assert.deepEqual(u.photos(), []);
  assert.ok(u.logs.includes('Upload of clip.mov stopped partway; nothing kept.'), u.logs.join('\n'));
});

test('the website clears a batch before it is sent', async () => {
  const u = uploads();
  const r = await u.call('POST', '/api/uploads/check',
    { files: [{ name: 'a.jpg', bytes: 3 * MB }, { name: 'b.mov', bytes: 200 * MB }, { name: 'c.png', bytes: MB }] }, '4321');
  assert.equal(r.status, 200, r.body);
  assert.equal(r.json.message, 'Ready to add 3 files.');
  assert.deepEqual(u.photos(), []);
});

test('the website refuses a batch with the wrong PIN before it is sent', async () => {
  const u = uploads();
  const r = await u.call('POST', '/api/uploads/check', { files: [{ name: 'a.jpg', bytes: 10 }, { name: 'b.jpg', bytes: 10 }] }, '1111');
  assert.equal(r.json && r.json.error, 'Wrong PIN.');
  // It counted as one wrong PIN: four more make five, and uploads lock.
  for (let i = 0; i < 4; i++) await u.upload('x.jpg', 10, '1111');
  assert.equal((await u.upload('a.jpg', 10, '4321')).json.error, 'Too many wrong PINs. Try again after 6:05 PM.');
});

test("the website refuses a batch that wouldn't fit before it is sent", async () => {
  const u = uploads({ free: 3 * GB });
  const r = await u.call('POST', '/api/uploads/check',
    { files: [{ name: 'a.mov', bytes: 600 * MB }, { name: 'b.mov', bytes: 600 * MB }] }, '4321');
  assert.equal(r.json && r.json.error, 'Not enough room on the box for these 2 files: 2 GB must stay free.');
});

test('the website lists the uploads in the order they play', async () => {
  const u = uploads();
  u.put('00002-b.mp4', 20);
  u.put('00001-a.jpg', 10);
  u.put('.upload-123');
  u.put('notes.txt');
  const r = await u.call('GET', '/api/uploads');
  assert.deepEqual(r.json, {
    pinSet: true,
    uploads: [{ name: '00001-a.jpg', kind: 'photo', bytes: 10 }, { name: '00002-b.mp4', kind: 'video', bytes: 20 }],
  });
});

test('the website lists no uploads when there are none', async () => {
  const u = uploads({ pin: null });
  const r = await u.call('GET', '/api/uploads');
  assert.deepEqual(r.json, { pinSet: false, uploads: [] });
});

const bytesOf = (r) => {
  const all = fs.readFileSync(r.path);
  return all.subarray(r.start, r.end + 1);
};

test('the website sends an upload', async () => {
  const u = uploads();
  u.put('00001-a.jpg', 50);
  const r = u.w.fileResponse('/photos/00001-a.jpg');
  assert.equal(r.status, 200);
  assert.equal(r.headers['Content-Type'], 'image/jpeg');
  assert.ok(/max-age=31536000/.test(r.headers['Cache-Control']), r.headers['Cache-Control']);
  assert.ok(bytesOf(r).equals(fs.readFileSync(u.root + '/photos/00001-a.jpg')));
});

test('the website sends part of a video when asked for a range', async () => {
  const u = uploads();
  u.put('00002-b.mp4', 1000);
  const r = u.w.fileResponse('/photos/00002-b.mp4', 'bytes=0-1');
  assert.equal(r.status, 206);
  assert.equal(r.headers['Content-Type'], 'video/mp4');
  assert.equal(r.headers['Content-Range'], 'bytes 0-1/1000');
  assert.equal(bytesOf(r).length, 2);
});

test('the website sends the rest of a video from a byte onwards', async () => {
  const u = uploads();
  u.put('00002-b.mp4', 1000);
  const r = u.w.fileResponse('/photos/00002-b.mp4', 'bytes=900-');
  assert.equal(r.status, 206);
  assert.equal(r.headers['Content-Range'], 'bytes 900-999/1000');
  assert.equal(bytesOf(r).length, 100);
});

test('the website refuses a range past the end of an upload', async () => {
  const u = uploads();
  u.put('00002-b.mp4', 1000);
  const r = u.w.fileResponse('/photos/00002-b.mp4', 'bytes=1000-');
  assert.equal(r.status, 416);
  assert.equal(r.headers['Content-Range'], 'bytes */1000');
});

test('the website sends nothing outside the uploads', async () => {
  const u = uploads();
  u.put('.upload-123');
  fs.writeFileSync(u.root + '/override.json', '{}');
  for (const p of ['/photos/../override.json', '/photos/.upload-123', '/photos/missing.jpg']) {
    const r = u.w.fileResponse(p);
    assert.equal(r.status, 404, p);
    assert.equal(JSON.parse(r.body).error, 'Not found.');
  }
});

test('the website removes an upload with the right PIN', async () => {
  const u = uploads();
  u.put('00001-a.jpg');
  const r = await u.call('POST', '/api/uploads/remove', { name: '00001-a.jpg' }, '4321');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(u.photos(), []);
  assert.equal(r.json.message, 'Removed 00001-a.jpg.');
  assert.ok(u.logs.includes('Removed photos/00001-a.jpg (from the website)'), u.logs.join('\n'));
  assert.deepEqual(u.removed, [u.root + '/photos/00001-a.jpg']);
});

test('a new upload joins the end of the picks', async () => {
  const u = uploads();
  fs.mkdirSync(u.root + '/thanksgiving');
  fs.writeFileSync(u.root + '/thanksgiving/dusk.mp4', 'v');
  fs.writeFileSync(u.root + '/picks.json', JSON.stringify({ picks: ['thanksgiving/dusk.mp4'] }));
  const r = await u.upload('a.jpg');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(JSON.parse(fs.readFileSync(u.root + '/picks.json', 'utf8')).picks, ['thanksgiving/dusk.mp4', 'photos/00001-a.jpg']);
  assert.equal(u.picksChanged, 1, 'the player is told the picks changed');
});

test('removing an upload takes it out of the picks', async () => {
  const u = uploads();
  u.put('00001-a.jpg');
  fs.mkdirSync(u.root + '/thanksgiving');
  fs.writeFileSync(u.root + '/thanksgiving/dusk.mp4', 'v');
  fs.writeFileSync(u.root + '/picks.json', JSON.stringify({ picks: ['photos/00001-a.jpg', 'thanksgiving/dusk.mp4'] }));
  const r = await u.call('POST', '/api/uploads/remove', { name: '00001-a.jpg' }, '4321');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(JSON.parse(fs.readFileSync(u.root + '/picks.json', 'utf8')).picks, ['thanksgiving/dusk.mp4']);
  assert.equal(u.picksChanged, 1, 'the player is told the picks changed');
});

test('the website refuses to remove an upload with the wrong PIN', async () => {
  const u = uploads();
  u.put('00001-a.jpg');
  const r = await u.call('POST', '/api/uploads/remove', { name: '00001-a.jpg' }, '1111');
  assert.equal(r.json && r.json.error, 'Wrong PIN.');
  assert.deepEqual(u.photos(), ['00001-a.jpg']);
  assert.deepEqual(u.removed, [], 'nothing taken off the TV');
});

test("the website refuses to remove something that isn't an upload", async () => {
  const u = uploads();
  u.put('.upload-123');
  fs.writeFileSync(u.root + '/status', 'x\n');
  for (const name of ['../status', '.upload-123', 'missing.jpg']) {
    const r = await u.call('POST', '/api/uploads/remove', { name }, '4321');
    assert.ok(r.json && r.json.error && r.json.error.startsWith('No upload named ' + name), name + ': ' + r.body);
  }
  assert.ok(fs.existsSync(u.root + '/status'));
  assert.deepEqual(u.photos(), ['.upload-123']);
  assert.deepEqual(u.removed, [], 'nothing taken off the TV');
});

// ---- Review fixes: numbers, leftovers, errors ----

test("a removed upload's number is never given again", async () => {
  const u = uploads();
  await u.upload('a.jpg');
  await u.upload('b.jpg');
  await u.call('POST', '/api/uploads/remove', { name: '00002-b.jpg' }, '4321');
  const r = await u.upload('b.jpg');
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(u.photos(), ['00001-a.jpg', '00003-b.jpg']);
});

test('part files left from before the box restarted are removed', async () => {
  const u = uploads();
  u.put('.upload-abc123');
  u.put('00001-a.jpg');
  createWebsite(Object.assign(realIo(), { config, videoRoot: u.root, now: () => u.now, freeBytes: () => u.free, startSync: () => true }));
  assert.deepEqual(u.photos(), ['00001-a.jpg']);
});

test('an upload the box fails to write is logged as an error', async () => {
  const u = uploads();
  const { Writable } = require('stream');
  const real = fs.createWriteStream;
  fs.createWriteStream = (p, o) => {
    real(p, o).destroy(); // the part file exists, as on the box
    return new Writable({ write(chunk, enc, done) { done(Object.assign(new Error('no space left on device'), { code: 'ENOSPC' })); } });
  };
  let r;
  try { r = await u.upload('clip.mov', 1000); } finally { fs.createWriteStream = real; }
  assert.equal(r.status, 400);
  assert.deepEqual(u.photos(), []);
  assert.ok(u.logs.includes('ERROR: Upload of clip.mov failed on the box: no space left on device'), u.logs.join('\n'));
  assert.ok(u.logs.includes('Upload of clip.mov stopped partway; nothing kept.'));
});

test('a phone dropping off mid-upload is not logged as an error', async () => {
  const u = uploads();
  const stream = new Readable({
    read() {
      this.push(Buffer.alloc(100, 1));
      this.destroy(Object.assign(new Error('read ETIMEDOUT'), { code: 'ETIMEDOUT' }));
    },
  });
  const r = await u.w.receiveUpload({ name: 'clip.mov', pin: '4321', length: 1000, stream });
  assert.equal(r.status, 400);
  assert.deepEqual(u.photos(), []);
  assert.ok(!u.logs.some((l) => l.startsWith('ERROR')), u.logs.join('\n'));
  assert.ok(u.logs.includes('Upload of clip.mov stopped partway; nothing kept.'));
});

test('a range sends exactly those bytes', async () => {
  const u = uploads();
  fs.mkdirSync(u.root + '/photos');
  const data = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));
  fs.writeFileSync(u.root + '/photos/00001-v.mp4', data);
  for (const [range, start, end] of [['bytes=5-9', 5, 9], ['bytes=-10', 990, 999], ['bytes=995-5000', 995, 999]]) {
    const r = u.w.fileResponse('/photos/00001-v.mp4', range);
    assert.equal(r.status, 206, range);
    assert.deepEqual([r.start, r.end], [start, end], range);
    assert.equal(r.headers['Content-Length'], end - start + 1, range);
  }
});

test("the website won't show a folder inside photos", async () => {
  const u = uploads();
  fs.mkdirSync(u.root + '/photos/x', { recursive: true });
  const r = await u.call('POST', '/api/show', { target: 'photos/x' });
  assert.equal(r.status, 400, r.body);
  assert.ok(!fs.existsSync(u.root + '/override.json'));
});

// ---- The page adds and removes photos ----

// The page's batch flow, run on its own with a fake box and page.
function batchFlow() {
  const page = PAGE_TEXT();
  const code = page.split('<script>').map((p) => p.split('</script>')[0]).find((p) => p.includes('function sendBatch'));
  assert.ok(code, 'the page has sendBatch');
  const context = {};
  require('vm').runInNewContext(code + '\nthis.sendBatch = sendBatch;', context);
  return context.sendBatch;
}
let pageText = null;
const PAGE_TEXT = () => pageText;

test('the website page offers adding and removing photos', async () => {
  const s = site();
  const page = (await s.call('GET', '/')).body;
  for (const text of ['Add photos or videos', 'type="file"', 'accept="image/*,video/*"', 'multiple', 'id="pin"',
    'id="uploads"', "fetch('/api/uploads')", '>Remove<', 'Adding photos is off until a PIN is set on the box.', 'preload="metadata"']) {
    assert.ok(page.includes(text), 'page has ' + text);
  }
  assertScriptCompiles(page);
});

function fakeBatch(checkAnswer) {
  const calls = [];
  const said = [];
  const progress = [];
  let forgot = 0;
  const api = {
    check: async (pin, files) => { calls.push(['check', pin, files.map((f) => f.name)]); return checkAnswer; },
    upload: async (file, pin) => { calls.push(['upload', pin, file.name]); return { ok: true, message: 'Added ' + file.name + '.' }; },
  };
  const ui = {
    say: (text, error) => said.push([text, !!error]),
    progress: (name, text) => progress.push([name, text]),
    forgetPin: () => { forgot++; },
  };
  return { api, ui, calls, said, progress, forgot: () => forgot };
}

test('the page sends a batch only after the box clears it', async () => {
  pageText = (await site().call('GET', '/')).body;
  const sendBatch = batchFlow();
  const f = fakeBatch({ ok: true, message: 'Ready to add 3 files.' });
  const files = [{ name: 'a.jpg', size: 3 }, { name: 'b.mov', size: 200 }, { name: 'c.png', size: 1 }];
  await sendBatch(files, '4321', f.api, f.ui);
  assert.deepEqual(f.calls, [
    ['check', '4321', ['a.jpg', 'b.mov', 'c.png']],
    ['upload', '4321', 'a.jpg'], ['upload', '4321', 'b.mov'], ['upload', '4321', 'c.png'],
  ]);
  assert.deepEqual(f.progress.filter((p) => /^Added/.test(p[1])),
    [['a.jpg', 'Added a.jpg.'], ['b.mov', 'Added b.mov.'], ['c.png', 'Added c.png.']]);
});

test('the page stops a batch at a wrong PIN and asks for it again', async () => {
  pageText = (await site().call('GET', '/')).body;
  const sendBatch = batchFlow();
  const f = fakeBatch({ ok: false, error: 'Wrong PIN.' });
  const files = ['1', '2', '3', '4', '5'].map((n) => ({ name: n + '.jpg', size: 1 }));
  await sendBatch(files, '1111', f.api, f.ui);
  assert.deepEqual(f.calls.map((c) => c[0]), ['check']);
  assert.ok(f.said.some(([text, error]) => text === 'Wrong PIN.' && error), JSON.stringify(f.said));
  assert.equal(f.forgot(), 1);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
