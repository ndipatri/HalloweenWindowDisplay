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
const STARTING = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'playlists', 'filters.json'), 'utf8');
const TAGS = ROOT + '/tags.json';
const FILTERS = ROOT + '/filters.json';
const GITHUB = ROOT + '/github-filters.json';

// A website with fake files. `dirs` maps folder paths (relative to the
// video folder) to the names in them. `extra`: filters (default: the starting
// set), tags, files, now, log, filtersChanged.
function site(dirs = {}, extra = {}) {
  const files = Object.assign({}, extra.files || {});
  // Custom filters if given; the GitHub filters (by default the repo's) unless only custom ones are given.
  if (extra.filters) files[FILTERS] = JSON.stringify({ filters: extra.filters });
  if (extra.github) files[GITHUB] = JSON.stringify({ filters: extra.github });
  else if (!extra.filters) files[GITHUB] = STARTING;
  if (extra.tags) files[TAGS] = JSON.stringify({ tags: extra.tags });
  const folders = { [ROOT]: [] };
  for (const [k, v] of Object.entries(dirs)) {
    folders[ROOT + '/' + k] = folders[ROOT + '/' + k] || [];
    for (const n of v) if (!folders[ROOT + '/' + k].includes(n)) folders[ROOT + '/' + k].push(n);
    const parts = k.split('/');
    for (let i = 0; i < parts.length; i++) {
      const parent = [ROOT].concat(parts.slice(0, i)).join('/');
      folders[parent] = folders[parent] || [];
      if (!folders[parent].includes(parts[i])) folders[parent].push(parts[i]);
    }
  }
  const sync = { running: false, started: 0 };
  const w = createWebsite({
    config,
    videoRoot: ROOT,
    now: () => extra.now || SIX_PM,
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
    // Uploads are portrait unless named otherwise, as in player.test.js.
    mediaSize: (p) => {
      const n = p.split('/').pop();
      if (n.includes('broken')) return null;
      if (n.includes('wide')) return { width: 160, height: 96 };
      if (n.includes('square')) return { width: 100, height: 100 };
      return { width: 96, height: 160 };
    },
    log: extra.log,
    filtersChanged: extra.filtersChanged,
    readAddress: 'address' in extra ? () => extra.address : () => '10.0.0.25',
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

// ---- Shows what is on screen ----

test('the website shows what is on screen now', async () => {
  const s = site();
  s.files[ROOT + '/status'] = 'Halloween kid (scheduled until 7:30 PM)\n';
  const r = await s.call('GET', '/api/status');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'Halloween kid (scheduled until 7:30 PM)');
});

test('the website says when the box has not started yet', async () => {
  const s = site();
  const r = await s.call('GET', '/api/status');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, null);
  assert.ok((await s.call('GET', '/advanced')).body.includes("r.status || 'The box has not started yet.'"));
});

// ---- Shows tags for a while ----

// A box with something for each tag and starting filter.
const FULL = { halloween: ['fuzzy.mp4'], 'halloween/grownup': ['jump.mp4'], thanksgiving: ['dusk.mp4'], photos: ['00001-a.jpg'] };
const fullSite = (extra) => site(FULL, Object.assign({ tags: { 'photos/00001-a.jpg': ['favorites'] } }, extra));

test('the website shows tags until the schedule changes', async () => {
  const s = fullSite();
  const r = await show(s, { tags: ['halloween-grownup'], until: 'schedule' });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(s.override(), { tags: ['halloween-grownup'], filters: [], setAt: +SIX_PM, expires: null, untilCleared: false });
  assert.equal(r.json.message, 'Showing #halloween-grownup until the schedule next changes.');
});

test('the website shows tags for a number of minutes', async () => {
  const s = fullSite();
  const r = await show(s, { tags: ['favorites'], until: 30 });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(s.override().tags, ['favorites']);
  assert.equal(s.override().expires, +SIX_PM + 30 * 60 * 1000);
  assert.equal(r.json.message, 'Showing #favorites until 6:30 PM, then back to the schedule.');
});

test('the website shows several tags until switched back', async () => {
  const s = fullSite();
  const r = await show(s, { tags: ['halloween', 'thanksgiving'], until: 'cleared' });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(s.override().tags, ['halloween', 'thanksgiving']);
  assert.equal(s.override().untilCleared, true);
  assert.equal(r.json.message, 'Showing #halloween + #thanksgiving until you choose Back to schedule.');
});

test('the website shows a tag and a filter together', async () => {
  const s = fullSite();
  const r = await show(s, { tags: ['favorites', 'favorites'], filters: ['Halloween kid', 'Halloween kid'], until: 'cleared' });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual([s.override().tags, s.override().filters, s.override().untilCleared], [['favorites'], ['Halloween kid'], true]);
  assert.equal(r.json.message, 'Showing #favorites + Halloween kid until you choose Back to schedule.');
});

test('the website turns the screen black', async () => {
  const s = fullSite();
  const r = await show(s, { target: 'black', until: 'schedule' });
  assert.equal(s.override().tags, null);
  assert.equal(r.json.message, 'Showing black until the schedule next changes.');
});

// ---- Back to the schedule ----

test('the website goes back to the schedule', async () => {
  const s = fullSite();
  s.files[OVERRIDE] = JSON.stringify({ tags: ['favorites'], filters: [], setAt: +SIX_PM, expires: null, untilCleared: true });
  const r = await s.call('POST', '/api/schedule');
  assert.equal(s.override(), null);
  assert.equal(r.json.message, 'Override cancelled. Following the schedule.');
});

// ---- Refuses bad choices of tags ----

test('the website refuses a tag no item has', async () => {
  const s = fullSite();
  for (const tags of [['halloween', 'easter'], ['../x']]) {
    const r = await show(s, { tags });
    assert.equal(r.status, 400, r.body);
    const bad = tags[tags.length - 1];
    assert.ok(r.json.error.startsWith('No tag called') && r.json.error.includes(bad), r.json.error);
  }
  assert.equal(s.override(), null);
});

test("the website refuses a filter it doesn't have", async () => {
  const s = fullSite();
  const r = await show(s, { filters: ['Easter'] });
  assert.equal(r.status, 400, r.body);
  assert.equal(r.json.error, 'No filter called Easter on the box.');
  assert.equal(s.override(), null);
});

test('the website refuses to show no tags', async () => {
  const s = fullSite();
  const r = await show(s, { tags: [], filters: [] });
  assert.equal(r.status, 400, r.body);
  assert.equal(r.json.error, 'Pick one or more tags or filters to play.');
  assert.equal(s.override(), null);
});

test("the website refuses minutes that aren't a whole number above zero", async () => {
  const s = fullSite();
  for (const until of [0, -5, 2.5, 'soon']) {
    const r = await show(s, { tags: ['halloween'], until });
    assert.equal(r.status, 400, String(until));
    assert.ok(r.json.error.startsWith('Not a number of minutes'), r.json.error);
  }
  assert.equal(s.override(), null);
});

// ---- Offers the tags under Play ----

test('the website lists the tags as choices', async () => {
  const s = site({ halloween: ['fuzzy.mp4'], 'halloween/grownup': ['jump.mp4'], thanksgiving: ['dusk.mp4'], christmas: ['tree.mp4'], photos: ['00001-a.jpg'] },
    { tags: { 'photos/00001-a.jpg': ['favorites'] }, github: JSON.parse(STARTING).filters });
  const r = await s.call('GET', '/api/choices');
  assert.deepEqual(r.json.tags, ['christmas', 'favorites', 'upload']);
  assert.deepEqual(r.json.filters, ['Halloween kid', 'Halloween grownup', 'Thanksgiving']);
});

test('the page offers each tag under Play, to pick several and play', async () => {
  const page = (await site().call('GET', '/advanced')).body;
  const load = page.slice(page.indexOf('async function load()'), page.indexOf('let filterNames') > 0 ? page.length : page.length);
  assert.ok(/for \(const tag of c\.tags\)[\s\S]*?pickButton\(tagLabel\(tag\), '#' \+ tag\)/.test(load), 'a button per tag, labelled as words');
  assert.ok(/for \(const name of c\.filters\)[\s\S]*?pickButton\(name, name\)/.test(load), 'a button per filter');
  assert.ok(page.includes('id="tagpicks"') && page.includes('id="filterpicks"'), 'tags and filters in rows of their own');
  assert.ok(page.includes('id="play-picked"') && page.includes(">Play<"), 'a Play button');
  assert.ok(page.includes("$('play-picked').disabled = !picked.size"), 'Play is off while nothing is selected');
  assert.ok(/'\/api\/show', \{ tags[\s\S]*?filters[\s\S]*?until: \$\('until'\)\.value \}/.test(page), 'Play shows what is picked for the chosen duration');
  assertScriptCompiles(page);
});

test('the page labels tags as words', async () => {
  const tagLabel = await pageFunction('tagLabel');
  assert.deepEqual(['halloween-grownup', 'favorites', 'upload'].map(tagLabel), ['Halloween grownup', 'Favorites', 'Uploads']);
});

// ---- The page highlights the playing tags ----

test('the page shows the status under Play and outlines what is playing', async () => {
  const page = (await site().call('GET', '/advanced')).body;
  const body = page.slice(page.indexOf('<main>'));
  const play = body.indexOf('<h2>Play</h2>');
  assert.ok(play !== -1 && body.indexOf('id="status"') > play && body.indexOf('id="status"') < body.indexOf('id="tagpicks"'),
    'the status line is in the Play section, before its buttons');
  assert.ok(!body.slice(0, play).includes('class="card"'), 'no separate status card above Play');
  assert.ok(page.includes('data-choice="black"'), 'Black can be outlined');
  assert.ok(/button\.current \{[^}]*outline/.test(page), 'the playing buttons are outlined');
  assert.ok(page.includes("setAttribute('aria-current', 'true')"), 'and marked as current');
  const refresh = page.slice(page.indexOf('async function refresh()'), page.indexOf('let filterNames'));
  assert.ok(refresh.includes('outline(playingChoices(r.status, filterNames))'), 'the outline follows the status');
  assertScriptCompiles(page);
});

// Pulls a function out of the page's DOM-free script block.
async function pageFunction(name) {
  const page = (await site().call('GET', '/advanced')).body;
  const code = page.split('<script>').map((p) => p.split('</script>')[0]).find((p) => p.includes('function ' + name));
  assert.ok(code, 'the page has ' + name);
  const context = {};
  require('vm').runInNewContext(code + '\nthis.' + name + ' = ' + name + ';', context);
  return context[name];
}

test('the page works out which tags are playing from the status', async () => {
  const playingChoices = await pageFunction('playingChoices');
  const filters = ['Halloween kid', 'Thanksgiving'];
  const cases = [
    ['#halloween + #thanksgiving (override until cleared)', ['#halloween', '#thanksgiving']],
    ['#favorites + Halloween kid (override until 6:30 PM)', ['#favorites', 'Halloween kid']],
    ['Thanksgiving (scheduled until 11:00 PM)', ['Thanksgiving']],
    ['black (nothing scheduled)', ['black']],
    ['black (waiting for the clock to be set)', ['black']],
    [null, []],
  ];
  for (const [status, choices] of cases) assert.deepEqual(Array.from(playingChoices(status, filters)), choices, String(status));
});

// ---- Which way the TV faces ----

test('the website saves which way the TV faces', async () => {
  const logs = [];
  const s = site({}, { log: (m) => logs.push(m) });
  assert.equal((await s.call('GET', '/api/screen')).json.orientation, 'portrait');
  const r = await s.call('POST', '/api/screen', { orientation: 'landscape' });
  assert.equal(r.status, 200, r.body);
  assert.match(r.json.message, /landscape TV/);
  assert.equal(JSON.parse(s.files[ROOT + '/screen.json']).orientation, 'landscape');
  assert.ok(logs.includes('Screen: landscape (from the website).'), logs.join('\n'));
  assert.equal((await s.call('GET', '/api/screen')).json.orientation, 'landscape');
});

test('the website refuses an unknown orientation', async () => {
  const s = site();
  const r = await s.call('POST', '/api/screen', { orientation: 'sideways' });
  assert.equal(r.status, 400);
  assert.ok(!((ROOT + '/screen.json') in s.files));
});

test('the page offers Portrait and Landscape', async () => {
  const page = (await site().call('GET', '/advanced')).body;
  const body = page.slice(page.indexOf('<main>'));
  const tv = body.indexOf('<h2>TV</h2>');
  assert.ok(tv !== -1, 'a TV section');
  const section = body.slice(tv, body.indexOf('<h2>', tv + 1));
  assert.ok(section.includes('data-tv="portrait"') && section.includes('data-tv="landscape"'), section);
  const refresh = page.slice(page.indexOf('async function refresh()'), page.indexOf('let filterNames'));
  assert.ok(refresh.includes("fetch('/api/screen')") && refresh.includes('markScreen('), 'the saved way is marked');
  assert.ok(page.includes("post('/api/screen'"), 'the buttons save it');
  assertScriptCompiles(page);
});

// ---- The address code ----

test('the address code is on until switched off', async () => {
  const s = site();
  assert.deepEqual((await s.call('GET', '/api/address-code')).json, { show: true, url: 'http://10.0.0.25/' });
  assert.deepEqual((await site({}, { address: null }).call('GET', '/api/address-code')).json, { show: true, url: null });
  // Unreadable counts as on.
  assert.equal((await site({}, { files: { [ROOT + '/address-code.json']: 'nonsense' } }).call('GET', '/api/address-code')).json.show, true);
});

test('the address code is switched off and on with no PIN', async () => {
  const logs = [];
  const s = site({}, { log: (m) => logs.push(m) });
  let r = await s.call('POST', '/api/address-code', { show: false });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(JSON.parse(s.files[ROOT + '/address-code.json']), { show: false });
  assert.equal((await s.call('GET', '/api/address-code')).json.show, false);
  assert.ok(logs.includes('Address code on the TV: off (from the website).'), logs.join('\n'));
  r = await s.call('POST', '/api/address-code', { show: true });
  assert.equal(r.status, 200);
  assert.equal((await s.call('GET', '/api/address-code')).json.show, true);
  for (const bad of [{ show: 'no' }, {}, { show: 1 }]) {
    r = await s.call('POST', '/api/address-code', bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  assert.deepEqual(JSON.parse(s.files[ROOT + '/address-code.json']), { show: true });
});

test('the page has the address code switch under TV', async () => {
  const page = (await site().call('GET', '/advanced')).body;
  const body = page.slice(page.indexOf('<main>'));
  const tv = body.indexOf('<h2>TV</h2>');
  const section = body.slice(tv, body.indexOf('<h2>', tv + 1));
  assert.ok(section.includes('<input id="addresscode" type="checkbox"> Show the box\'s address on the TV'), section);
  assert.ok(section.includes('id="address"'), section);
  const refresh = page.slice(page.indexOf('async function refresh()'), page.indexOf('let filterNames'));
  assert.ok(refresh.includes("fetch('/api/address-code')") && refresh.includes("$('addresscode').checked = a.show"), 'ticked as the box has it');
  assert.ok(refresh.includes("'No network address.'"), 'says when there is none');
  assert.ok(page.includes("post('/api/address-code', { show: $('addresscode').checked })"), 'the checkbox saves it');
  assertScriptCompiles(page);
});

// ---- Tags ----

test('the website adds a box tag to an upload', async () => {
  const logs = [];
  let changed = 0;
  const s = site({ photos: ['00001-a.jpg'] }, { log: (m) => logs.push(m), filtersChanged: async () => { changed++; } });
  const r = await s.call('POST', '/api/tags', { path: 'photos/00001-a.jpg', add: 'favorites' });
  assert.equal(r.status, 200, r.body);
  assert.equal(changed, 1, 'the player is told');
  assert.equal(r.json.message, 'Tagged 00001-a.jpg favorites.');
  assert.deepEqual(JSON.parse(s.files[TAGS]).tags['photos/00001-a.jpg'], ['favorites']);
  const item = (await s.call('GET', '/api/items')).json.items.find((i) => i.path === 'photos/00001-a.jpg');
  assert.deepEqual(item.folderTags.concat(item.boxTags), ['upload', 'favorites']);
  assert.ok(logs.includes('Tags: photos/00001-a.jpg + favorites (from the website).'), logs.join('\n'));
});

test('the website removes a box tag from an upload', async () => {
  const s = site({ photos: ['00001-a.jpg'] }, { tags: { 'photos/00001-a.jpg': ['favorites'] } });
  const r = await s.call('POST', '/api/tags', { path: 'photos/00001-a.jpg', remove: 'favorites' });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.json.message, 'Took favorites off 00001-a.jpg.');
  const item = (await s.call('GET', '/api/items')).json.items.find((i) => i.path === 'photos/00001-a.jpg');
  assert.deepEqual(item.folderTags.concat(item.boxTags), ['upload']);
});

test('a box tag can repeat a folder tag', async () => {
  const s = site({ halloween: ['fuzzy.mp4'], photos: ['00001-a.jpg'] });
  const r = await s.call('POST', '/api/tags', { path: 'photos/00001-a.jpg', add: 'halloween' });
  assert.equal(r.status, 200, r.body);
  const item = (await s.call('GET', '/api/items')).json.items.find((i) => i.path === 'photos/00001-a.jpg');
  assert.deepEqual(item.folderTags.concat(item.boxTags), ['upload', 'halloween']);
});

test("the website refuses a tag name it can't use", async () => {
  const s = site({ photos: ['00001-a.jpg'] });
  for (const bad of ['Fav Orites', '', '-x', 'a'.repeat(31)]) {
    const r = await s.call('POST', '/api/tags', { path: 'photos/00001-a.jpg', add: bad });
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.ok(r.json.error.startsWith('Not a tag name:') && r.json.error.endsWith('Use lowercase letters, digits and dashes.'), r.json.error);
  }
  for (const change of [{ add: 'upload' }, { remove: 'upload' }]) {
    const u = await s.call('POST', '/api/tags', Object.assign({ path: 'photos/00001-a.jpg' }, change));
    assert.equal(u.json.error, 'upload is given to every upload by the box.');
  }
  assert.ok(!(TAGS in s.files), 'nothing saved');
});

test('the website refuses to tag a video from GitHub', async () => {
  const s = site({ halloween: ['fuzzy.mp4'] });
  for (const change of [{ add: 'favorites' }, { remove: 'halloween' }]) {
    const r = await s.call('POST', '/api/tags', Object.assign({ path: 'halloween/fuzzy.mp4' }, change));
    assert.equal(r.status, 400, r.body);
    assert.equal(r.json.error, 'halloween/fuzzy.mp4 comes from GitHub: its tag comes from its folder there.');
  }
  assert.ok(!(TAGS in s.files), 'nothing saved');
});

test("the website refuses to tag something that isn't an item", async () => {
  const s = site({ halloween: ['poster.jpg'], photos: ['00001-a.jpg'] });
  s.files[ROOT + '/status'] = 'x\n';
  for (const p of ['../status', 'halloween/poster.jpg', 'photos/missing.jpg']) {
    const r = await s.call('POST', '/api/tags', { path: p, add: 'favorites' });
    assert.equal(r.status, 404, p);
    assert.ok(r.json.error.startsWith('No item') && r.json.error.includes(p), r.json.error);
  }
  assert.ok(!(TAGS in s.files));
});

test('the website lists the uploads and their tags', async () => {
  const s = site({ halloween: ['fuzzy.mp4'], 'halloween/kid': ['x.mp4'], photos: ['00001-a.jpg', '00002-b.mov'] },
    { tags: { 'photos/00001-a.jpg': ['family'] } });
  const r = await s.call('GET', '/api/items');
  assert.deepEqual(r.json.items.map((i) => [i.path, i.folderTags.join(), i.boxTags.join()]), [
    ['photos/00001-a.jpg', 'upload', 'family'],
    ['photos/00002-b.mov', 'upload', ''],
  ]);
  assert.deepEqual(r.json.tags, ['family', 'halloween', 'halloween-kid', 'upload']);
});

test('the website says each upload\'s measured shape', async () => {
  const s = site({ photos: ['00001-tall.jpg', '00002-wide.mp4', '00003-square.png', '00004-broken.jpg'] },
    { tags: { 'photos/00002-wide.mp4': ['portrait'] } });
  const r = await s.call('GET', '/api/items');
  assert.deepEqual(r.json.items.map((i) => i.shape), ['portrait', 'landscape', 'square', null]);
});

test('the website page marks each untagged upload\'s thumbnail with its measured shape', async () => {
  const page = (await site().call('GET', '/advanced')).body;
  for (const text of ['class="shape"', 'item.shape', "'?'", "includes('portrait')", "includes('landscape')"]) {
    assert.ok(page.includes(text), 'page has ' + text);
  }
  assertScriptCompiles(page);
});

test('box tags of an item no longer on the box are left out', async () => {
  const s = site({ photos: ['00001-a.jpg'] }, { tags: { 'photos/00009-gone.jpg': ['family'] } });
  const r = await s.call('GET', '/api/items');
  assert.ok(!r.json.items.some((i) => i.path === 'photos/00009-gone.jpg'));
  assert.ok(!r.json.tags.includes('family'));
});

test('box tags on a video from GitHub are ignored and dropped', async () => {
  const s = site({ halloween: ['fuzzy.mp4'], photos: ['00001-a.jpg'] },
    { tags: { 'halloween/fuzzy.mp4': ['favorites'], 'photos/00001-a.jpg': ['favorites'] } });
  // With only the GitHub video tagged, nothing is tagged favorites.
  const onlyRepo = site({ halloween: ['fuzzy.mp4'], photos: ['00001-a.jpg'] }, { tags: { 'halloween/fuzzy.mp4': ['favorites'] } });
  const refused = await show(onlyRepo, { tags: ['favorites'], until: 'cleared' });
  assert.equal(refused.status, 400, refused.body);
  const show1 = await show(s, { tags: ['favorites'], until: 'cleared' });
  assert.equal(show1.status, 200, show1.body);
  const r = await s.call('POST', '/api/tags', { path: 'photos/00001-a.jpg', add: 'family' });
  assert.equal(r.status, 200, r.body);
  const tags = JSON.parse(s.files[TAGS]).tags;
  assert.ok(!('halloween/fuzzy.mp4' in tags), JSON.stringify(tags));
  assert.deepEqual(tags['photos/00001-a.jpg'], ['favorites', 'family']);
});

test('the box turns the old picks into favorites', async () => {
  const logs = [];
  const s = site({ halloween: ['fuzzy.mp4'], photos: ['00001-a.jpg'] }, {
    log: (m) => logs.push(m),
    files: { [ROOT + '/picks.json']: JSON.stringify({ picks: ['halloween/fuzzy.mp4', 'photos/00001-a.jpg', 'photos/00009-gone.jpg'] }) },
  });
  const tags = JSON.parse(s.files[TAGS] || '{"tags":{}}').tags;
  assert.deepEqual(tags['photos/00001-a.jpg'], ['favorites']);
  assert.ok(!('halloween/fuzzy.mp4' in tags), JSON.stringify(tags));
  assert.ok(!(ROOT + '/picks.json' in s.files), 'picks.json is gone');
  assert.ok(logs.includes('My picks are now tagged favorites (1).'), logs.join('\n'));
});

// ---- Filters ----

const christmas = { name: 'Christmas', anyOf: ['christmas'], except: [],
  schedule: [{ from: '12-01', to: '12-31', times: [{ start: '17:00', stop: '23:00' }] }] };
const late = { name: 'Late', anyOf: ['halloween'], except: [],
  schedule: [{ from: '01-01', to: '12-31', weekdays: ['fri'], times: [{ start: '22:00', stop: '01:00' }] }] };
const filterSite = (extra = {}) => site({}, Object.assign({ filters: [late] }, extra));
const saved = (s) => JSON.parse(s.files[FILTERS]).filters;

test('the website lists the filters', async () => {
  const late = { name: 'Late', anyOf: ['halloween'], except: [], schedule: [{ from: '12-01', to: '12-31' }] };
  const party = { name: 'Party', anyOf: ['halloween'], except: [], schedule: [{ from: '12-01', to: '12-31' }] };
  const kid = { name: 'Halloween kid', anyOf: ['halloween', 'halloween-kid'], except: [],
    schedule: [{ from: '10-01', to: '10-31', times: [{ start: '05:00', stop: '07:00' }] }] };
  const thanks = { name: 'Thanksgiving', anyOf: ['thanksgiving'], except: [], schedule: [{ from: '11-01', to: '11-30' }] };
  const s = site({}, { filters: [late, party], github: [kid, thanks] });
  const r = await s.call('GET', '/api/filters');
  assert.deepEqual(r.json.custom, [late, party]);
  assert.deepEqual(r.json.github, [kid, thanks]);
});

test('the website saves the filters with no PIN', async () => {
  const logs = [];
  let changed = 0;
  const s = filterSite({ log: (m) => logs.push(m), filtersChanged: async () => { changed++; } });
  const r = await s.call('POST', '/api/filters', { filters: [christmas, late] });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(saved(s).map((f) => f.name), ['Christmas', 'Late']);
  assert.equal(r.json.message, 'Saved 2 filters.');
  assert.ok(logs.includes('Filters changed (from the website): Christmas, Late.'), logs.join('\n'));
  assert.equal(changed, 1);
});

test("the website refuses a filter it can't use", async () => {
  const s = filterSite({ github: [{ name: 'Halloween kid', anyOf: ['halloween'], schedule: [{ from: '10-01', to: '10-31' }] }] });
  const f = (o) => Object.assign({}, christmas, o);
  const bad = [
    [[f({ name: '' })], 'Filter 1'],
    [[f({ name: 'Black' })], 'Black'],
    [[f({ name: 'Kid' }), f({ name: 'kid' })], 'kid'],
    [[f({ name: 'halloween KID' })], 'halloween KID'],
    [[f({ name: 'Kid (old)' })], 'Kid (old)'],
    [[f({ anyOf: [] })], 'Christmas'],
    [[f({ schedule: [] })], 'Christmas'],
    [[f({ anyOf: ['Fav Orites'] })], 'Christmas'],
    [[f({ schedule: [{ from: '13-01', to: '12-31' }] })], 'Christmas'],
    [[f({ schedule: [{ from: '12-01', to: '12-31', times: [{ start: '25:00', stop: '23:00' }] }] })], 'Christmas'],
  ];
  for (const [filters, named] of bad) {
    const r = await s.call('POST', '/api/filters', { filters });
    assert.equal(r.status, 400, JSON.stringify(filters) + ' ' + r.body);
    assert.ok(r.json.error.startsWith(named + ':') && r.json.error.length > named.length + 3, r.json.error);
  }
  assert.deepEqual(saved(s).map((x) => x.name), ['Late']);
});

// ---- The page tags items and edits filters ----

test('the website page offers tagging items', async () => {
  const page = (await site().call('GET', '/advanced')).body;
  for (const text of ['<h2>Photos and videos</h2>', 'id="taglist"', "fetch('/api/items')", "'/api/tags'", '<datalist id="tagnames">',
    'Videos from GitHub take their tags from their folders',
    "c.className = 'chip'", "{ add: 'favorites' }", "{ remove: 'favorites' }", '☆', '★', '×']) {
    assert.ok(page.includes(text), 'page has ' + text);
  }
  assertScriptCompiles(page);
});

test('the website page offers editing filters with no PIN', async () => {
  const page = (await site().call('GET', '/advanced')).body;
  for (const text of ['<h2>Filters</h2>', 'id="filterlist"', "fetch('/api/filters')", "'/api/filters'",
    'id="filter-note"', 'New filter', 'Save filters', 'moveFilter(', '↑', '↓', 'Edit', 'Delete', 'Any of', 'Except', 'Times',
    'id="githubfilters"', 'From GitHub', 'changed there']) {
    assert.ok(page.includes(text), 'page has ' + text);
  }
  for (const text of ['id="filter-pin"', 'X-Upload-Pin', 'Type the PIN first.']) assert.ok(!page.includes(text), 'no PIN: ' + text);
  assertScriptCompiles(page);
});

test('the page moves a filter up and down', async () => {
  const moveFilter = await pageFunction('moveFilter');
  const first = moveFilter(['Halloween kid', 'Christmas', 'Favorites'], 2, -1);
  assert.deepEqual(Array.from(first), ['Halloween kid', 'Favorites', 'Christmas']);
  const second = moveFilter(first, 0, 1);
  assert.deepEqual(Array.from(second), ['Favorites', 'Halloween kid', 'Christmas']);
  assert.deepEqual(Array.from(moveFilter(second, 0, -1)), Array.from(second), 'the first stays first');
});

// ---- Durations, choices, sync and activity (unchanged) ----

test('the page starts For how long on until switched back', async () => {
  const page = (await site().call('GET', '/advanced')).body;
  const select = page.slice(page.indexOf('<select id="until">'), page.indexOf('</select>', page.indexOf('<select id="until">')));
  const chosen = select.split('<option').filter((o) => /\sselected[\s>]/.test(o.split('>')[0] + '>'));
  assert.equal(chosen.length, 1, 'one option chosen: ' + select);
  assert.ok(chosen[0].includes('value="cleared"'), chosen[0]);
  for (const v of ['schedule', '15', '30', '60']) assert.ok(select.includes('value="' + v + '"'), 'still offers ' + v);
});

test('the website page offers each choice', async () => {
  const s = site();
  const r = await s.call('GET', '/advanced');
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
  const page = (await s.call('GET', '/advanced')).body;
  assert.ok(!page.includes('Sync now'), 'the old wording is gone');
  for (const text of ['<h2>New videos from GitHub</h2>', 'The box checks GitHub for new videos every hour by itself.',
    'id="sync">Check for new videos now<', 'id="sync-note"', "setText($('sync-note')", 'Recent activity', 'id="log"', "fetch('/api/log')", "post('/api/sync', {}, true)"]) {
    assert.ok(page.includes(text), 'page has ' + text);
  }
  assertScriptCompiles(page);
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

function uploads({ free = 20 * GB } = {}) {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-test-')), 'video-scheduler');
  fs.mkdirSync(root);
  const u = { root, logs: [], removed: [], now: new Date(2026, 10, 4, 18, 0), free };
  u.w = createWebsite(Object.assign(realIo(), {
    config,
    videoRoot: root,
    now: () => u.now,
    freeBytes: () => u.free,
    log: (m) => u.logs.push(m),
    // Taken off mpv while the file is still there.
    beforeRemove: async (p) => { assert.ok(fs.existsSync(p), 'removed before mpv let go'); u.removed.push(p); },
    filtersChanged: async () => { u.filtersChanged = (u.filtersChanged || 0) + 1; },
    startSync: () => true,
  }));
  const answer = (r) => Object.assign({}, r, { json: r.type === 'application/json' ? JSON.parse(r.body) : null });
  // Sends `name` with `bytes` (a number of bytes, or a Buffer).
  u.upload = async (name, bytes = 1000) => {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.alloc(bytes, 7);
    return answer(await u.w.receiveUpload({ name, length: data.length, stream: Readable.from([data]) }));
  };
  // Declares `length` bytes, but a body that must never be read.
  u.declare = async (name, length) => {
    u.bodyRead = false;
    const stream = new Readable({ read() { u.bodyRead = true; this.push(null); } });
    return answer(await u.w.receiveUpload({ name, length, stream }));
  };
  u.call = async (method, p, body) => answer(await u.w.handle({
    method, path: p, headers: {},
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

test('the website adds a photo with no PIN', async () => {
  const u = uploads();
  const data = Buffer.alloc(2 * MB, 9);
  const r = await u.upload('IMG_1234.JPG', data);
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(u.photos(), ['00001-img_1234.jpg']);
  assert.ok(fs.readFileSync(u.root + '/photos/00001-img_1234.jpg').equals(data));
  assert.equal(r.json.message, 'Added IMG_1234.JPG.');
  assert.ok(u.logs.includes('Uploaded photos/00001-img_1234.jpg (2.0 MB)'), u.logs.join('\n'));
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
  const done = u.w.receiveUpload({ name: 'clip.mov', length: 10 * MB, stream });
  stream.push(Buffer.alloc(5 * MB, 3));
  stream.push(null);
  await done;
  assert.deepEqual(u.photos(), []);
  assert.ok(u.logs.includes('Upload of clip.mov stopped partway; nothing kept.'), u.logs.join('\n'));
});

test('the website clears a batch before it is sent', async () => {
  const u = uploads();
  const r = await u.call('POST', '/api/uploads/check',
    { files: [{ name: 'a.jpg', bytes: 3 * MB }, { name: 'b.mov', bytes: 200 * MB }, { name: 'c.png', bytes: MB }] });
  assert.equal(r.status, 200, r.body);
  assert.equal(r.json.message, 'Ready to add 3 files.');
  assert.deepEqual(u.photos(), []);
});

test("the website refuses a batch that wouldn't fit before it is sent", async () => {
  const u = uploads({ free: 3 * GB });
  const r = await u.call('POST', '/api/uploads/check',
    { files: [{ name: 'a.mov', bytes: 600 * MB }, { name: 'b.mov', bytes: 600 * MB }] });
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
    uploads: [{ name: '00001-a.jpg', kind: 'photo', bytes: 10 }, { name: '00002-b.mp4', kind: 'video', bytes: 20 }],
  });
});

test('the website lists no uploads when there are none', async () => {
  const u = uploads();
  const r = await u.call('GET', '/api/uploads');
  assert.deepEqual(r.json, { uploads: [] });
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

test('the website removes an upload with no PIN', async () => {
  const u = uploads();
  u.put('00001-a.jpg');
  const r = await u.call('POST', '/api/uploads/remove', { name: '00001-a.jpg' });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(u.photos(), []);
  assert.equal(r.json.message, 'Removed 00001-a.jpg.');
  assert.ok(u.logs.includes('Removed photos/00001-a.jpg (from the website)'), u.logs.join('\n'));
  assert.deepEqual(u.removed, [u.root + '/photos/00001-a.jpg']);
});

test('removing an upload drops its box tags', async () => {
  const u = uploads();
  u.put('00001-a.jpg');
  fs.writeFileSync(u.root + '/tags.json', JSON.stringify({ tags: { 'photos/00001-a.jpg': ['family'], 'halloween/fuzzy.mp4': ['favorites'] } }));
  const r = await u.call('POST', '/api/uploads/remove', { name: '00001-a.jpg' });
  assert.equal(r.status, 200, r.body);
  const tags = JSON.parse(fs.readFileSync(u.root + '/tags.json', 'utf8')).tags;
  assert.ok(!('photos/00001-a.jpg' in tags), JSON.stringify(tags));
  assert.ok(!('halloween/fuzzy.mp4' in tags), 'box tags on a video from GitHub are dropped too');
  assert.equal(u.filtersChanged, 1, 'the player is told');
});

test("the website refuses to remove something that isn't an upload", async () => {
  const u = uploads();
  u.put('.upload-123');
  fs.writeFileSync(u.root + '/status', 'x\n');
  for (const name of ['../status', '.upload-123', 'missing.jpg']) {
    const r = await u.call('POST', '/api/uploads/remove', { name });
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
  await u.call('POST', '/api/uploads/remove', { name: '00002-b.jpg' });
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
  const r = await u.w.receiveUpload({ name: 'clip.mov', length: 1000, stream });
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
  const page = (await s.call('GET', '/advanced')).body;
  for (const text of ['Add photos or videos', 'type="file"', 'accept="image/*,video/*"', 'multiple',
    '>Remove<', 'preload="metadata"']) {
    assert.ok(page.includes(text), 'page has ' + text);
  }
  for (const text of ['id="pin"', 'Adding photos is off', 'X-Upload-Pin', 'Type the PIN first.']) assert.ok(!page.includes(text), 'no PIN: ' + text);
  // One section: the picker, then each upload once with its tags and Remove.
  const section = page.slice(page.indexOf('<h2>Photos and videos</h2>'), page.indexOf('<h2>Filters</h2>'));
  for (const text of ['id="files"', 'id="taglist"']) assert.ok(section.includes(text), 'section has ' + text);
  for (const text of ['<h2>Tags</h2>', '<h2>Add photos or videos</h2>', '<h2>Photos and videos added</h2>', 'id="uploads"']) {
    assert.ok(!page.includes(text), 'page no longer has ' + text);
  }
  assertScriptCompiles(page);
});

function fakeBatch(checkAnswer) {
  const calls = [];
  const said = [];
  const progress = [];
  const api = {
    check: async (files) => { calls.push(['check', files.map((f) => f.name)]); return checkAnswer; },
    upload: async (file) => { calls.push(['upload', file.name]); return { ok: true, message: 'Added ' + file.name + '.' }; },
  };
  const ui = {
    say: (text, error) => said.push([text, !!error]),
    progress: (name, text) => progress.push([name, text]),
  };
  return { api, ui, calls, said, progress };
}

test('the page sends a batch only after the box clears it', async () => {
  pageText = (await site().call('GET', '/advanced')).body;
  const sendBatch = batchFlow();
  const f = fakeBatch({ ok: true, message: 'Ready to add 3 files.' });
  const files = [{ name: 'a.jpg', size: 3 }, { name: 'b.mov', size: 200 }, { name: 'c.png', size: 1 }];
  await sendBatch(files, f.api, f.ui);
  assert.deepEqual(f.calls, [
    ['check', ['a.jpg', 'b.mov', 'c.png']],
    ['upload', 'a.jpg'], ['upload', 'b.mov'], ['upload', 'c.png'],
  ]);
  assert.deepEqual(f.progress.filter((p) => /^Added/.test(p[1])),
    [['a.jpg', 'Added a.jpg.'], ['b.mov', 'Added b.mov.'], ['c.png', 'Added c.png.']]);
});

test("a picks file that can't be read is kept, and logged", async () => {
  const logs = [];
  const s = site({ halloween: ['fuzzy.mp4'] }, { log: (m) => logs.push(m), files: { [ROOT + '/picks.json']: '{not json' } });
  assert.ok(ROOT + '/picks.json' in s.files, 'picks.json is kept');
  assert.ok(logs.some((l) => l.startsWith("ERROR: Couldn't turn the old My picks")), logs.join('\n'));
});

test('tagging still works with a bad entry in tags.json', async () => {
  const s = site({ photos: ['00001-a.jpg'] }, { files: { [TAGS]: JSON.stringify({ tags: { 'photos/00009-x.jpg': null } }) } });
  const r = await s.call('POST', '/api/tags', { path: 'photos/00001-a.jpg', add: 'favorites' });
  assert.equal(r.status, 200, r.body);
});

test('a video from GitHub is refused before its tag is even checked', async () => {
  const s = site({ halloween: ['fuzzy.mp4'] });
  for (const change of [{ add: 'upload' }, { add: 'Bad Name' }]) {
    const r = await s.call('POST', '/api/tags', Object.assign({ path: 'halloween/fuzzy.mp4' }, change));
    assert.equal(r.json.error, 'halloween/fuzzy.mp4 comes from GitHub: its tag comes from its folder there.');
  }
});

test('with no uploads the website lists no items, but still every tag in use', async () => {
  const r = await site({ halloween: ['fuzzy.mp4'] }).call('GET', '/api/items');
  assert.deepEqual(r.json.items, []);
  assert.deepEqual(r.json.tags, ['halloween']);
});

test('a GitHub folder named upload is still not an upload', async () => {
  const s = site({ upload: ['x.mp4'] });
  const r = await s.call('POST', '/api/tags', { path: 'upload/x.mp4', add: 'favorites' });
  assert.equal(r.status, 400, r.body);
  assert.deepEqual((await s.call('GET', '/api/items')).json.items, []);
});

test("adding upload's own tag again is refused, not stored", async () => {
  const s = site({ photos: ['00001-a.jpg'] });
  const r = await s.call('POST', '/api/tags', { path: 'photos/00001-a.jpg', add: 'upload' });
  assert.equal(r.status, 400);
});

test('custom copies of the GitHub filters are dropped when the website starts', async () => {
  const logs = [];
  const raw = JSON.parse(STARTING).filters;
  const party = { name: 'Party', anyOf: ['halloween'], except: [], schedule: [{ from: '12-01', to: '12-31' }] };
  const s = site({}, { log: (m) => logs.push(m), github: raw, filters: [raw[0], party, raw[2]] });
  assert.deepEqual(JSON.parse(s.files[FILTERS]).filters.map((f) => f.name), ['Party']);
  for (const name of ['Halloween kid', 'Thanksgiving']) {
    assert.ok(logs.includes('Dropping the custom filter ' + name + ': GitHub has a filter of that name.'), logs.join('\n'));
  }
});

test('a custom filter without days and times is dropped when the website starts', async () => {
  const logs = [];
  const party = { name: 'Party', anyOf: ['halloween'], except: [], schedule: [{ from: '12-01', to: '12-31' }] };
  const s = site({}, { log: (m) => logs.push(m), github: JSON.parse(STARTING).filters, filters: [{ name: 'Favorites', anyOf: ['favorites'] }, party] });
  assert.deepEqual(JSON.parse(s.files[FILTERS]).filters.map((f) => f.name), ['Party']);
  assert.ok(logs.includes('Dropping the custom filter Favorites: a filter needs days and times now; pick its tags under Play instead.'), logs.join('\n'));
});

test('the choices list custom filters before the GitHub ones', async () => {
  const s = site({}, { filters: [{ name: 'Party', anyOf: ['halloween'], schedule: [{ from: '01-01', to: '12-31' }] }], github: JSON.parse(STARTING).filters });
  const r = await s.call('GET', '/api/choices');
  assert.deepEqual(r.json.filters, ['Party', 'Halloween kid', 'Halloween grownup', 'Thanksgiving']);
});

test('custom copies are only dropped once, so a later clash keeps the custom filter', async () => {
  const party = { name: 'Party', anyOf: ['halloween'], except: [], schedule: [{ from: '12-01', to: '12-31' }] };
  const s = site({}, { github: [{ name: 'Halloween kid', anyOf: ['halloween'] }], filters: [party],
    files: { [ROOT + '/.custom-copies-dropped']: 'done\n' } });
  // GitHub now has a Party too: the custom one is kept in the file (skipped, not deleted).
  const s2 = site({}, { github: [{ name: 'Party', anyOf: ['x'] }], filters: [party],
    files: { [ROOT + '/.custom-copies-dropped']: 'done\n' } });
  assert.deepEqual(JSON.parse(s.files[FILTERS]).filters.map((f) => f.name), ['Party']);
  assert.deepEqual(JSON.parse(s2.files[FILTERS]).filters.map((f) => f.name), ['Party']);
});

// ---- The easy page ----

// An uploads box with a GitHub folder tagged halloween.
function visitorBox() {
  const u = uploads();
  fs.mkdirSync(u.root + '/halloween', { recursive: true });
  fs.writeFileSync(u.root + '/halloween/ghost.mp4', 'x');
  u.check = (name, files = [{ name: 'a.jpg', bytes: 10 }]) => u.call('POST', '/api/uploads/check', { name, files });
  u.sendFor = async (name, tag, bytes = 1000) => {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.alloc(bytes, 7);
    const r = await u.w.receiveUpload({ name, length: data.length, stream: Readable.from([data]), tag });
    return Object.assign({}, r, { json: JSON.parse(r.body) });
  };
  u.tags = () => {
    try { return JSON.parse(fs.readFileSync(u.root + '/tags.json', 'utf8')).tags; } catch (e) { return {}; }
  };
  return u;
}

// The easy page's flow, run on its own with a fake box and page.
async function visitFlow(form, answers = {}) {
  const page = (await site().call('GET', '/')).body;
  const code = page.split('<script>').map((p) => p.split('</script>')[0]).find((p) => p.includes('function sendVisit'));
  assert.ok(code, 'the easy page has sendVisit');
  const context = {};
  require('vm').runInNewContext(code + '\nthis.sendVisit = sendVisit;', context);
  const calls = [];
  const said = [];
  const api = {
    check: async (files, name) => { calls.push(['check', files.map((f) => f.name), name]); return answers.check || { ok: true, tag: 'aunt-sue' }; },
    upload: async (file, tag, onProgress) => { calls.push(['upload', file.name, tag]); onProgress(100); return (answers.upload && answers.upload(file)) || { ok: true, saved: '0000' + (calls.length) + '-' + file.name }; },
    play: async (tag, keep) => { calls.push(['play', tag, keep]); return { ok: true }; },
  };
  const ui = {
    say: (text, error) => said.push([text, Boolean(error)]),
    progress: () => {},
    remember: (name) => calls.push(['remember', name]),
  };
  const result = await context.sendVisit(form, api, ui);
  return { result, calls, said };
}

test('the easy page is at the box\'s address', async () => {
  const r = await site().call('GET', '/');
  assert.equal(r.status, 200);
  assert.equal(r.type, 'text/html');
  assert.ok(!r.body.includes('id="pin"') && !r.body.includes('X-Upload-Pin'), 'no PIN field');
  for (const text of ['<title>tvBox</title>', 'id="name"', 'type="file"', 'accept="image/*,video/*"', 'multiple',
    '>Put them on the TV<', 'href="/advanced"']) {
    assert.ok(r.body.includes(text), 'easy page has ' + text);
  }
  assert.ok(!r.body.includes('>Back to schedule<'), 'not the advanced page');
  assertScriptCompiles(r.body);
});

test('the address code opens the easy page', async () => {
  const { addressUrl } = require('../address_code.js');
  const url = addressUrl('10.0.0.25', 80);
  assert.equal(url, 'http://10.0.0.25/');
  const r = await site().call('GET', new URL(url).pathname);
  assert.ok(r.body.includes('>Put them on the TV<'));
});

test('the advanced page is at /advanced and links to the easy page', async () => {
  const r = await site().call('GET', '/advanced');
  assert.equal(r.status, 200);
  for (const text of ['<title>tvBox</title>', '<h1>tvBox', '>Back to schedule<', '>Black<', '<h2>Play</h2>', 'href="/"']) assert.ok(r.body.includes(text), 'advanced page has ' + text);
});

test('a visitor\'s name becomes their tag', async () => {
  const u = visitorBox();
  const tagFor = async (name) => { const r = await u.check(name); assert.equal(r.status, 200, r.body); return r.json.tag; };
  assert.equal(await tagFor('Aunt Sue'), 'aunt-sue');
  assert.equal(await tagFor('José María'), 'jose-maria');
  assert.equal(await tagFor('  Bob  O\'Brien!! '), 'bob-o-brien');
  const long = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmn';
  assert.equal(await tagFor(long), long.slice(0, 30));
  // Without a name, check is as before: no tag.
  const plain = await u.call('POST', '/api/uploads/check', { files: [{ name: 'a.jpg', bytes: 10 }] });
  assert.equal(plain.status, 200);
  assert.equal(plain.json.tag, undefined);
});

test('a name the box uses is refused', async () => {
  const u = visitorBox();
  for (const name of ['Halloween', 'Upload', 'portrait']) {
    const r = await u.check(name);
    assert.equal(r.status, 400, name);
    assert.equal(r.json.error, 'That name is taken by the box. Try adding your last name.');
  }
});

test('a name with no letters or numbers is refused', async () => {
  const u = visitorBox();
  assert.equal((await u.check('   ')).json.error, 'Type your name first.');
  assert.equal((await u.check('!!!')).json.error, 'Use some letters or numbers in your name.');
});

test('each visitor upload is tagged with their name', async () => {
  const u = visitorBox();
  const r = await u.sendFor('Beach.JPG', 'aunt-sue', Buffer.alloc(2 * MB, 3));
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(u.photos(), ['00001-beach.jpg']);
  assert.deepEqual(u.tags(), { 'photos/00001-beach.jpg': ['aunt-sue'] });
  assert.ok(u.logs.includes('Uploaded photos/00001-beach.jpg (2.0 MB) for aunt-sue'), u.logs.join('\n'));
  assert.equal(u.filtersChanged, 1, 'the player is told');
  // It plays: aunt-sue is a tag in use.
  assert.equal((await u.call('POST', '/api/show', { tags: ['aunt-sue'], until: 'cleared' })).status, 200);
});

test('a visitor upload with a tag the box uses is refused', async () => {
  const u = visitorBox();
  for (const tag of ['halloween', 'upload']) {
    const r = await u.sendFor('Beach.JPG', tag);
    assert.equal(r.status, 400);
    assert.equal(r.json.error, 'That name is taken by the box. Try adding your last name.');
  }
  assert.equal((await u.sendFor('Beach.JPG', 'Not A Tag')).status, 400);
  assert.deepEqual(u.photos(), []);
});

test('the visitor\'s pictures play until changed', async () => {
  const f = await visitFlow({ name: ' Aunt Sue ', files: [{ name: 'a.jpg', size: 5 }, { name: 'b.mp4', size: 9 }] });
  assert.equal(f.result, true);
  assert.deepEqual(f.calls, [
    ['check', ['a.jpg', 'b.mp4'], 'Aunt Sue'],
    ['remember', 'Aunt Sue'],
    ['upload', 'a.jpg', 'aunt-sue'],
    ['upload', 'b.mp4', 'aunt-sue'],
    ['play', 'aunt-sue', ['00003-a.jpg', '00004-b.mp4']],
  ]);
  assert.deepEqual(f.said.pop(), ['Done! Your pictures are on the TV now.', false]);
  // The box keeps just those two under aunt-sue and plays it until cleared.
  const u = visitorBox();
  const a = await u.sendFor('a.jpg', 'aunt-sue');
  const b = await u.sendFor('b.mp4', 'aunt-sue');
  assert.deepEqual([a.json.saved, b.json.saved], ['00001-a.jpg', '00002-b.mp4']);
  const played = await u.call('POST', '/api/visitor/play', { tag: 'aunt-sue', keep: [a.json.saved, b.json.saved] });
  assert.equal(played.status, 200, played.body);
  const o = JSON.parse(fs.readFileSync(u.root + '/override.json', 'utf8'));
  assert.deepEqual([o.tags, o.untilCleared], [['aunt-sue'], true]);
});

test('nothing plays when an upload is refused', async () => {
  const form = { name: 'Halloween', files: [{ name: 'a.jpg', size: 5 }] };
  const taken = 'That name is taken by the box. Try adding your last name.';
  const f = await visitFlow(form, { check: { ok: false, error: taken } });
  assert.equal(f.result, false);
  assert.deepEqual(f.said, [[taken, true]]);
  assert.ok(!f.calls.some((c) => c[0] === 'play' || c[0] === 'upload'));
  // Refused partway: stops there, plays nothing.
  const g = await visitFlow({ name: 'Aunt Sue', files: [{ name: 'a.jpg' }, { name: 'b.jpg' }] },
    { upload: (file) => (file.name === 'a.jpg' ? { ok: false, error: 'Too big: one file can be at most 4 GB.' } : null) });
  assert.equal(g.result, false);
  assert.deepEqual(g.said, [['Too big: one file can be at most 4 GB.', true]]);
  assert.ok(!g.calls.some((c) => c[0] === 'play' || (c[0] === 'upload' && c[1] === 'b.jpg')), 'nothing played, so nothing old deleted');
});

test('the easy page needs a name and a file', async () => {
  const files = [{ name: 'a.jpg', size: 5 }];
  for (const [form, text] of [
    [{ name: ' ', files }, 'Type your name first.'],
    [{ name: 'Aunt Sue', files: [] }, 'Choose some photos or videos first.'],
  ]) {
    const f = await visitFlow(form);
    assert.equal(f.result, false);
    assert.deepEqual(f.said, [[text, true]]);
    assert.deepEqual(f.calls, [], 'nothing sent');
  }
});

test('a returning visitor\'s old pictures are replaced', async () => {
  const u = visitorBox();
  u.put('00001-old.jpg', 5);
  u.put('00002-other.jpg', 5);
  fs.writeFileSync(u.root + '/tags.json', JSON.stringify({ tags: {
    'photos/00001-old.jpg': ['aunt-sue', 'favorites'], 'photos/00002-other.jpg': ['bob'] } }));
  const tag = (await u.check('Aunt Sue')).json.tag;
  const n1 = (await u.sendFor('new.jpg', tag)).json.saved;
  const n2 = (await u.sendFor('new2.jpg', tag)).json.saved;
  assert.deepEqual([n1, n2], ['00003-new.jpg', '00004-new2.jpg']);
  assert.ok(u.photos().includes('00001-old.jpg'), 'nothing old goes until the batch is done');
  const r = await u.call('POST', '/api/visitor/play', { tag, keep: [n1, n2] });
  assert.equal(r.status, 200, r.body);
  assert.deepEqual(u.photos(), ['00002-other.jpg', '00003-new.jpg', '00004-new2.jpg']);
  assert.deepEqual(u.tags(), {
    'photos/00002-other.jpg': ['bob'], 'photos/00003-new.jpg': ['aunt-sue'], 'photos/00004-new2.jpg': ['aunt-sue'],
  });
  assert.ok(u.logs.includes('Removed photos/00001-old.jpg (aunt-sue added new pictures)'), u.logs.join('\n'));
  assert.deepEqual(u.removed, [u.root + '/photos/00001-old.jpg'], 'taken off mpv first');
  const o = JSON.parse(fs.readFileSync(u.root + '/override.json', 'utf8'));
  assert.deepEqual([o.tags, o.untilCleared], [['aunt-sue'], true]);
});

test('the box keeps only a visitor\'s own new pictures', async () => {
  const u = visitorBox();
  u.put('00001-a.jpg', 5);
  u.put('00002-b.jpg', 5);
  fs.writeFileSync(u.root + '/tags.json', JSON.stringify({ tags: { 'photos/00001-a.jpg': ['aunt-sue'], 'photos/00002-b.jpg': ['bob'] } }));
  for (const body of [{ tag: 'aunt-sue', keep: ['00002-b.jpg'] }, { tag: 'aunt-sue', keep: [] }, { tag: 'aunt-sue' },
    { tag: 'aunt-sue', keep: ['missing.jpg'] }, { tag: 'halloween', keep: ['00001-a.jpg'] }, { keep: ['00001-a.jpg'] }]) {
    const r = await u.call('POST', '/api/visitor/play', body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.deepEqual(u.photos(), ['00001-a.jpg', '00002-b.jpg']);
  assert.ok(!fs.existsSync(u.root + '/override.json'), 'nothing played');
});

// The easy page's page-code-free script (shapeOf, fitNote, sendVisit), run on its own.
async function easyScript() {
  const page = (await site().call('GET', '/')).body;
  const code = page.split('<script>').map((p) => p.split('</script>')[0]).find((p) => p.includes('function sendVisit'));
  const context = {};
  require('vm').runInNewContext(code + '\nthis.shapeOf = shapeOf; this.fitNote = fitNote;', context);
  return { page, shapeOf: context.shapeOf, fitNote: context.fitNote };
}

test('the easy page shows each picked file with its shape', async () => {
  const { page, shapeOf } = await easyScript();
  assert.deepEqual([shapeOf(3000, 4000), shapeOf(4080, 3072), shapeOf(1080, 1080), shapeOf(0, 0)],
    ['portrait', 'landscape', 'square', null]);
  for (const text of ['id="thumbs"', 'URL.createObjectURL(file)', 'naturalWidth', 'videoWidth', "preload = 'metadata'",
    "portrait: 'Portrait', landscape: 'Landscape', square: 'Square'", "label.textContent = shape ? LABELS[shape] : ''"]) {
    assert.ok(page.includes(text), 'easy page has ' + text);
  }
  assertScriptCompiles(page);
});

test('the easy page warns when no picked file fits the TV', async () => {
  const { page, fitNote } = await easyScript();
  assert.equal(fitNote(['landscape', 'landscape'], 'portrait'), "The TV is portrait, so landscape pictures won't show until it's turned.");
  assert.equal(fitNote(['portrait'], 'landscape'), "The TV is landscape, so portrait pictures won't show until it's turned.");
  for (const [shapes, way] of [[['landscape', 'portrait'], 'portrait'], [['landscape', 'square'], 'portrait'],
    [['portrait'], 'portrait'], [[null], 'portrait'], [[], 'landscape'], [['landscape', null], 'landscape']]) {
    assert.equal(fitNote(shapes, way), '', JSON.stringify([shapes, way]));
  }
  // An unmeasured file doesn't stop the warning for the rest.
  assert.ok(fitNote(['landscape', null], 'portrait'));
  for (const text of ['id="fit"', "fetch('/api/screen')", "$('fit').textContent = fitNote(shapes, tvWay)"]) {
    assert.ok(page.includes(text), 'easy page has ' + text);
  }
});

test('done says the pictures won\'t show until the TV is turned', async () => {
  const note = "The TV is portrait, so landscape pictures won't show until it's turned.";
  const f = await visitFlow({ name: 'Aunt Sue', files: [{ name: 'wide.jpg', size: 5 }], note });
  assert.equal(f.result, true);
  assert.deepEqual(f.said.pop(), ["Done! They're on the box, but the TV is portrait, so they won't show until it's turned.", false]);
  assert.ok(f.calls.some((c) => c[0] === 'play'), 'still sent and played');
  const g = await visitFlow({ name: 'Aunt Sue', files: [{ name: 'tall.jpg', size: 5 }], note: '' });
  assert.deepEqual(g.said.pop(), ['Done! Your pictures are on the TV now.', false]);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
