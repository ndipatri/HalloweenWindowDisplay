// Tests for the box's setup (scheduler/setup.sh), run with Node:
//   node scheduler/tests/setup.test.js
// Each test runs the real script as a dry run: TVBOX_ROOT stands in for /,
// with fake apt-get, systemctl and the other system commands first on PATH,
// and no terminal (stdin from /dev/null), as on a card's first boot.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'setup.sh');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// A throwaway machine: `root` stands in for /, `home` is the user's home.
// Every fake command appends its name and arguments to `calls`.
function machine() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-test-'));
  const m = {
    dir,
    root: path.join(dir, 'root'),
    home: path.join(dir, 'home'),
    fakes: path.join(dir, 'fakes'),
    calls: path.join(dir, 'calls'),
  };
  fs.mkdirSync(m.root);
  fs.mkdirSync(m.home);
  fs.mkdirSync(m.fakes);
  for (const name of ['apt-get', 'systemctl', 'timedatectl', 'usermod', 'groupadd', 'getent']) {
    fs.writeFileSync(path.join(m.fakes, name),
      '#!/bin/bash\necho "' + name + ' $*" >> "' + m.calls + '"\nexit 0\n', { mode: 0o755 });
  }
  m.videos = path.join(m.home, 'video-scheduler');
  m.pinFile = path.join(m.videos, 'upload-pin');
  m.run = (env = {}) => {
    const r = spawnSync('bash', [SCRIPT], {
      env: Object.assign({}, process.env, {
        TVBOX_ROOT: m.root,
        TVBOX_USER: 'tester',
        TVBOX_HOME: m.home,
        PATH: m.fakes + ':' + process.env.PATH,
      }, env),
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 60000,
    });
    return { status: r.status, out: r.stdout + r.stderr };
  };
  m.installed = () => fs.existsSync(m.calls) && fs.readFileSync(m.calls, 'utf8').includes('apt-get install');
  return m;
}

// ---- Setup sets the upload PIN ----

test('setup saves the upload PIN it is given', () => {
  const m = machine();
  const r = m.run({ TVBOX_UPLOAD_PIN: '4321' });
  assert.equal(r.status, 0, r.out);
  assert.ok(fs.existsSync(m.pinFile), 'the PIN file exists');
  assert.equal(fs.readFileSync(m.pinFile, 'utf8').trim(), '4321');
  assert.equal(fs.statSync(m.pinFile).mode & 0o777, 0o600);
});

test('setup keeps the saved upload PIN', () => {
  const m = machine();
  fs.mkdirSync(m.videos);
  // Saved before setup kept it private: setup keeps the PIN and makes the
  // file readable only by its owner.
  fs.writeFileSync(m.pinFile, '4321\n');
  fs.chmodSync(m.pinFile, 0o644);
  const r = m.run();
  assert.equal(r.status, 0, r.out);
  assert.equal(fs.readFileSync(m.pinFile, 'utf8').trim(), '4321');
  assert.equal(fs.statSync(m.pinFile).mode & 0o777, 0o600);
});

test("setup refuses an upload PIN that isn't 4 to 8 digits", () => {
  const m = machine();
  const r = m.run({ TVBOX_UPLOAD_PIN: '12a4' });
  assert.notEqual(r.status, 0);
  assert.ok(r.out.includes('The upload PIN must be 4 to 8 digits.'), r.out);
  assert.ok(!m.installed(), 'nothing installed');
  assert.ok(!fs.existsSync(path.join(m.root, 'opt/tvbox')), 'nothing copied');
  assert.ok(!fs.existsSync(m.pinFile));
});

test('setup without a PIN or a terminal leaves adding photos off', () => {
  const m = machine();
  const r = m.run();
  assert.equal(r.status, 0, r.out);
  assert.ok(r.out.includes('No upload PIN set, so adding photos is off. To turn it on: ' +
    'sudo TVBOX_UPLOAD_PIN=<4 to 8 digits> bash scheduler/setup.sh'), r.out);
  assert.ok(!fs.existsSync(m.pinFile));
});

test('setup makes the photos folder', () => {
  const m = machine();
  assert.equal(m.run().status, 0);
  assert.ok(fs.existsSync(path.join(m.videos, 'photos')), 'the photos folder exists');
  assert.ok(fs.statSync(path.join(m.videos, 'photos')).isDirectory());
  fs.writeFileSync(path.join(m.videos, 'photos', '00001-a.jpg'), 'A');
  const r = m.run();
  assert.equal(r.status, 0, r.out);
  assert.equal(fs.readFileSync(path.join(m.videos, 'photos', '00001-a.jpg'), 'utf8'), 'A');
});

test('setup lets the box read the tilt switch', () => {
  const m = machine();
  const r = m.run({ TVBOX_UPLOAD_PIN: '4321' });
  assert.equal(r.status, 0, r.out);
  const calls = fs.readFileSync(m.calls, 'utf8');
  assert.ok(/apt-get install .*\bgpiod\b/.test(calls), calls);
  assert.ok(/usermod -aG \S*\bgpio\b\S* tester/.test(calls), calls);
});

test('setup installs qrencode for the address code', () => {
  const m = machine();
  const r = m.run({ TVBOX_UPLOAD_PIN: '4321' });
  assert.equal(r.status, 0, r.out);
  const calls = fs.readFileSync(m.calls, 'utf8');
  assert.ok(/apt-get install .*\bqrencode\b/.test(calls), calls);
  assert.ok(fs.existsSync(path.join(m.root, 'opt', 'tvbox', 'address_code.js')), 'address_code.js is copied to /opt/tvbox');
});

test('setup adds no filters of its own', () => {
  const m = machine();
  const r = m.run();
  assert.equal(r.status, 0, r.out);
  assert.ok(!fs.existsSync(path.join(m.videos, 'filters.json')), 'no custom filters are made');
  assert.ok(!r.out.includes('Added the starting filters'), r.out);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
