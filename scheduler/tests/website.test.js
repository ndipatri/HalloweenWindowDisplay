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
function site(dirs = {}) {
  const files = {};
  const folders = { [ROOT]: [] };
  for (const [k, v] of Object.entries(dirs)) {
    folders[ROOT + '/' + k] = v;
    if (!k.includes('/')) folders[ROOT].push(k);
  }
  const w = createWebsite({
    config,
    videoRoot: ROOT,
    now: () => SIX_PM,
    readText: (p) => (p in files ? files[p] : null),
    writeText: (p, text) => { files[p] = text; },
    removeFile: (p) => { delete files[p]; },
    listFolder: (p) => (p in folders ? folders[p].slice() : null),
  });
  const call = (method, path, body) => {
    const r = w.handle({ method, path, body: body === undefined ? '' : JSON.stringify(body) });
    return Object.assign({}, r, { json: r.type === 'application/json' ? JSON.parse(r.body) : null });
  };
  const override = () => (OVERRIDE in files ? JSON.parse(files[OVERRIDE]) : null);
  return { files, call, override };
}

const show = (s, body) => s.call('POST', '/api/show', body);

// ---- Shows the status ----

test('the website shows what is on screen now', () => {
  const s = site();
  s.files[ROOT + '/status'] = 'halloween/kid (scheduled until 7:30 PM)\n';
  const r = s.call('GET', '/api/status');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'halloween/kid (scheduled until 7:30 PM)');
});

// ---- Overrides for a while ----

test('the website plays a playlist until the schedule changes', () => {
  const s = site();
  const r = show(s, { target: 'grownup', until: 'schedule' });
  assert.equal(r.status, 200);
  assert.deepEqual(s.override(), { playlist: 'grownup', setAt: +SIX_PM, expires: null, untilCleared: false });
  assert.equal(r.json.message, 'Showing grownup until the schedule next changes.');
});

test('the website plays a playlist for a number of minutes', () => {
  const s = site();
  const r = show(s, { target: 'kid', until: 30 });
  assert.equal(r.status, 200);
  assert.equal(s.override().playlist, 'kid');
  assert.equal(s.override().expires, +SIX_PM + 30 * 60 * 1000);
  assert.equal(s.override().untilCleared, false);
  assert.equal(r.json.message, 'Showing kid until 6:30 PM, then back to the schedule.');
});

test('the website plays a playlist until switched back', () => {
  const s = site();
  const r = show(s, { target: 'grownup', until: 'cleared' });
  assert.equal(s.override().playlist, 'grownup');
  assert.equal(s.override().untilCleared, true);
  assert.equal(s.override().expires, null);
  assert.equal(r.json.message, 'Showing grownup until you choose Back to schedule.');
});

test('the website turns the screen black', () => {
  const s = site();
  const r = show(s, { target: 'black', until: 'schedule' });
  assert.equal(s.override().playlist, null);
  assert.equal(r.json.message, 'Showing black until the schedule next changes.');
});

test('the website previews another season', () => {
  const s = site({ christmas: ['kid'], 'christmas/kid': [] });
  const r = show(s, { target: 'christmas/kid', until: 5 });
  assert.equal(r.status, 200, r.body);
  assert.equal(s.override().playlist, 'christmas/kid');
});

// ---- Back to the schedule ----

test('the website goes back to the schedule', () => {
  const s = site();
  s.files[OVERRIDE] = JSON.stringify({ playlist: 'grownup', setAt: +SIX_PM, expires: null, untilCleared: true });
  const r = s.call('POST', '/api/schedule');
  assert.equal(r.status, 200);
  assert.equal(s.override(), null);
  assert.equal(r.json.message, 'Override cancelled. Following the schedule.');
});

// ---- Refuses bad choices ----

test("the website refuses a name that isn't a playlist", () => {
  const s = site();
  for (const target of ['../x', 'a/b/c', '.hidden']) {
    const r = show(s, { target, until: 'schedule' });
    assert.equal(r.status, 400, target);
    assert.ok(r.json.error.startsWith('Not a playlist name'), r.json.error);
  }
  assert.equal(s.override(), null);
});

test('the website refuses a season that has no folder', () => {
  const s = site();
  const r = show(s, { target: 'easter/kid', until: 'schedule' });
  assert.equal(r.status, 400);
  assert.ok(r.json.error.startsWith('No easter folder on the box'), r.json.error);
  assert.equal(s.override(), null);
});

// ---- Lists the choices ----

test('the website lists what it can show', () => {
  const s = site({ halloween: ['grownup', 'fuzzy.mp4'], 'halloween/grownup': [], thanksgiving: [] });
  const r = s.call('GET', '/api/choices');
  assert.deepEqual(r.json.playlists, ['kid', 'grownup']);
  assert.deepEqual(r.json.previews, ['halloween', 'halloween/grownup', 'thanksgiving']);
});

test('the website page offers each choice', () => {
  const s = site();
  const r = s.call('GET', '/');
  assert.equal(r.status, 200);
  assert.equal(r.type, 'text/html');
  for (const text of ['>Black<', '>Back to schedule<',
    'value="schedule"', 'value="15"', 'value="30"', 'value="60"', 'value="cleared"']) {
    assert.ok(r.body.includes(text), 'page has ' + text);
  }
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
