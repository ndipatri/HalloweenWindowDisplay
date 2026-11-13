// Tests for the video sync (scheduler/sync_videos.sh), run with Node:
//   node scheduler/tests/sync.test.js
// Each test runs the real script against throwaway folders, with a local git
// repository standing in for GitHub. Needs bash and git.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'sync_videos.sh');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

// A throwaway setup: `github` (a bare repo), `repo` (the box's clone of it)
// and `root` (the box's ~/video-scheduler). `files` maps repo paths to
// contents for the first commit.
function setup(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
  const github = path.join(dir, 'github.git');
  const work = path.join(dir, 'work'); // where "someone" commits to GitHub
  const repo = path.join(dir, 'repo');
  const root = path.join(dir, 'video-scheduler');
  fs.mkdirSync(root);
  git(dir, 'init', '-q', '--bare', '-b', 'main', github);
  git(dir, 'clone', '-q', github, work);
  fs.writeFileSync(path.join(work, 'README.md'), 'test\n');
  write(work, files);
  git(work, 'add', '-A');
  git(work, 'commit', '-qm', 'first');
  git(work, 'push', '-q', 'origin', 'HEAD:main');
  git(dir, 'clone', '-q', github, repo);

  const s = {
    dir, github, work, repo, root, fakes: path.join(dir, 'fakes'),
    // Commits `files` to GitHub (not yet pulled by the box).
    commit(more, removed = []) {
      write(work, more);
      for (const r of removed) fs.rmSync(path.join(work, r), { recursive: true });
      git(work, 'add', '-A');
      git(work, 'commit', '-qm', 'more');
      git(work, 'push', '-q', 'origin', 'HEAD:main');
      return git(work, 'rev-parse', '--short', 'HEAD');
    },
    // Changes the box's repo directly, as a pull would have.
    local(more, removed = []) {
      write(repo, more);
      for (const r of removed) fs.rmSync(path.join(repo, r), { recursive: true });
    },
    box(rel) { return path.join(root, rel); },
    has(rel) { return fs.existsSync(path.join(root, rel)); },
    read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); },
    put(rel, text) { write(root, { [rel]: text }); },
    fake(name, body) {
      fs.mkdirSync(s.fakes, { recursive: true });
      fs.writeFileSync(path.join(s.fakes, name), '#!/bin/bash\n' + body + '\n', { mode: 0o755 });
    },
    // Runs sync; returns { status, log, seconds }.
    sync(args = [], env = {}) {
      const started = Date.now();
      const r = spawnSync('bash', [SCRIPT, ...args], {
        env: Object.assign({}, process.env, {
          VIDEO_SCHEDULER_REPO: repo,
          VIDEO_SCHEDULER_ROOT: root,
          PATH: (fs.existsSync(s.fakes) ? s.fakes + ':' : '') + process.env.PATH,
          GIT_TERMINAL_PROMPT: '0',
          // Short, so a broken time limit fails fast; tests that need
          // another set their own.
          VIDEO_SCHEDULER_PULL_TIMEOUT: '10',
        }, env),
        encoding: 'utf8',
        timeout: 60000,
      });
      return { status: r.status, log: r.stdout + r.stderr, seconds: (Date.now() - started) / 1000 };
    },
  };
  return s;
}

function write(base, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
    fs.writeFileSync(path.join(base, rel), text);
  }
}

const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);

// ---- Pulls from GitHub first ----

test('sync pulls the latest from GitHub before copying', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  const commit = s.commit({ 'playlists/halloween/new.mp4': 'new' });
  const r = s.sync();
  assert.equal(r.status, 0, r.log);
  assert.equal(s.read('halloween/new.mp4'), 'new');
  assert.ok(r.log.includes('Pulled the latest from GitHub (' + commit + ')'), r.log);
});

test('sync without pulling copies the repo as it is', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  s.commit({ 'playlists/halloween/new.mp4': 'new' });
  const before = git(s.repo, 'rev-parse', 'HEAD');
  const r = s.sync(['--no-pull']);
  assert.equal(r.status, 0, r.log);
  assert.equal(s.read('halloween/a.mp4'), 'a');
  assert.ok(!s.has('halloween/new.mp4'));
  assert.equal(git(s.repo, 'rev-parse', 'HEAD'), before);
  assert.ok(!r.log.includes('Pulled'), r.log);
});

// ---- Leaves nothing running ----

test('sync leaves nothing running when it finishes', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  // spawnSync returns only when the output pipe closes, so anything sync
  // left running with the pipe open would show up as time.
  const r = s.sync([], { VIDEO_SCHEDULER_PULL_TIMEOUT: '60' });
  assert.equal(r.status, 0, r.log);
  assert.ok(r.seconds < 10, 'output ended after ' + r.seconds + ' s');
});

// ---- One sync at a time ----

test('a sync that starts while another is running skips', async () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  // Hold the lock the way a running sync does, until killed.
  const holder = spawn('bash', ['-c', 'exec 9>"$1"; flock 9; echo held; exec sleep 30', '-', s.box('.sync.lock')]);
  try {
    await new Promise((resolve, reject) => {
      holder.stdout.on('data', (d) => d.toString().includes('held') && resolve());
      holder.on('exit', () => reject(new Error('lock holder exited')));
    });
    const r = s.sync();
    assert.equal(r.status, 0, r.log);
    assert.ok(r.log.includes('Skipped: another sync is already running.'), r.log);
    assert.ok(!s.has('halloween/a.mp4'));
  } finally {
    holder.kill('SIGKILL');
  }
});

// ---- Carries on without GitHub ----

test("sync uses the videos already in the repo when GitHub can't be reached", () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  git(s.repo, 'remote', 'set-url', 'origin', path.join(s.dir, 'no-such-github.git'));
  const r = s.sync();
  assert.equal(r.status, 0, r.log);
  assert.match(r.log, /Couldn't pull from GitHub \(.+\)\. Using the videos already in the repo\./);
  assert.equal(s.read('halloween/a.mp4'), 'a');
});

test("sync gives up on a pull that doesn't answer in time", () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  // A git that never finishes a pull; everything else goes to the real git.
  const realGit = execFileSync('bash', ['-c', 'command -v git']).toString().trim();
  s.fake('git', 'for a in "$@"; do [ "$a" = pull ] && exec sleep 20; done\nexec ' + realGit + ' "$@"');
  const r = s.sync([], { VIDEO_SCHEDULER_PULL_TIMEOUT: '1' });
  assert.equal(r.status, 0, r.log);
  assert.ok(r.seconds < 10, 'took ' + r.seconds + ' s');
  assert.ok(r.log.includes("Couldn't pull from GitHub (no answer within 1 seconds)"), r.log);
  assert.equal(s.read('halloween/a.mp4'), 'a');
});

// ---- Copies new and changed videos ----

test('sync copies new videos from the repo', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a', 'playlists/halloween/grownup/b.mp4': 'b' });
  const r = s.sync();
  assert.equal(r.status, 0, r.log);
  assert.equal(s.read('halloween/a.mp4'), 'a');
  assert.equal(s.read('halloween/grownup/b.mp4'), 'b');
  for (const line of ['Copied halloween/a.mp4', 'Copied halloween/grownup/b.mp4', 'Done: 2 copied, 0 moved aside.']) {
    assert.ok(r.log.includes(line), line + '\n' + r.log);
  }
});

test('sync replaces a video that changed in the repo', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'first' });
  s.sync();
  s.commit({ 'playlists/halloween/a.mp4': 'second' });
  const r = s.sync();
  assert.equal(s.read('halloween/a.mp4'), 'second');
  assert.ok(r.log.includes('Copied halloween/a.mp4'), r.log);
});

test("sync leaves a video that hasn't changed alone", () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  s.sync();
  const old = new Date(Date.now() - 3600 * 1000);
  fs.utimesSync(s.box('halloween/a.mp4'), old, old);
  const before = fs.statSync(s.box('halloween/a.mp4'));
  const r = s.sync();
  const after = fs.statSync(s.box('halloween/a.mp4'));
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.ok(r.log.includes('Done: 0 copied, 0 moved aside.'), r.log);
});

test('sync copies only videos', () => {
  const s = setup({
    'playlists/halloween/a.mp4': 'a', 'playlists/halloween/b.MOV': 'b', 'playlists/halloween/c.m4v': 'c',
    'playlists/halloween/notes.txt': 'n', 'playlists/halloween/.hidden.mp4': 'h', 'playlists/halloween/README': 'r',
  });
  s.sync();
  assert.deepEqual(list(s.box('halloween')), ['a.mp4', 'b.MOV', 'c.m4v']);
});

test('a video that fails to copy leaves nothing half-copied', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a whole video' });
  // A cp that writes part of the file, then fails.
  s.fake('cp', 'printf part > "${@: -1}"\nexit 1');
  const r = s.sync();
  assert.deepEqual(list(s.box('halloween')), []);
  assert.ok(r.log.includes("ERROR: Couldn't copy halloween/a.mp4"), r.log);
});

// ---- Sets removed videos aside ----

test('sync moves a video no longer in the repo aside, never deleting it', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  s.sync();
  s.put('halloween/old.mp4', 'old video');
  const r = s.sync();
  assert.ok(!s.has('halloween/old.mp4'));
  assert.equal(s.read('.removed/halloween/old.mp4'), 'old video');
  assert.ok(r.log.includes('Moved halloween/old.mp4 to .removed/halloween/ (no longer in the repo)'), r.log);
});

test('sync moves aside the videos of a subfolder no longer in the repo', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a', 'playlists/halloween/grownup/b.mp4': 'b' });
  s.sync();
  s.commit({}, ['playlists/halloween/grownup']);
  const r = s.sync();
  assert.equal(s.read('.removed/halloween/grownup/b.mp4'), 'b');
  assert.deepEqual(list(s.box('halloween/grownup')).filter((n) => n.endsWith('.mp4')), []);
  assert.ok(r.log.includes('Moved halloween/grownup/b.mp4 to .removed/halloween/grownup/ (folder no longer in the repo)'), r.log);
});

test("sync leaves a season folder the repo doesn't have alone", () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'a' });
  s.put('easter/egg.mp4', 'egg');
  s.put('easter/kid/chick.mp4', 'chick');
  s.sync();
  assert.equal(s.read('easter/egg.mp4'), 'egg');
  assert.equal(s.read('easter/kid/chick.mp4'), 'chick');
  assert.ok(!s.has('.removed/easter'));
});

// ---- Leaves the uploads alone ----

test('sync skips a photos folder in the repo', () => {
  const s = setup({
    'playlists/halloween/a.mp4': 'a',
    'playlists/photos/y.mp4': 'y',
  });
  // The repo has photos/ but no photos/old/: both of sync's loops would
  // set the box's videos aside if they didn't skip photos.
  s.put('photos/00001-a.jpg', 'A');
  s.put('photos/00002-b.mp4', 'B');
  s.put('photos/old/x.mp4', 'X');
  const r = s.sync(['--no-pull']);
  assert.equal(r.status, 0, r.log);
  assert.deepEqual(list(s.box('photos')), ['00001-a.jpg', '00002-b.mp4', 'old']);
  assert.deepEqual(list(s.box('photos/old')), ['x.mp4']);
  assert.equal(s.read('photos/00001-a.jpg'), 'A');
  assert.equal(s.read('photos/old/x.mp4'), 'X');
  assert.ok(!s.has('.removed/photos'));
  const skip = 'Skipping playlists/photos: that name is kept for uploads from the website.';
  assert.equal(r.log.split('\n').filter((l) => l.includes(skip)).length, 1, r.log);
});

// ---- Brings the GitHub filters ----

const GITHUB_FILTERS = JSON.stringify({ filters: [{ name: 'Favorites', anyOf: ['favorites'] }] }) + '\n';

test('sync copies the GitHub filters to the box', () => {
  const s = setup({ 'playlists/filters.json': GITHUB_FILTERS, 'playlists/halloween/a.mp4': 'A' });
  s.put('filters.json', 'mine\n');
  const first = s.sync();
  assert.equal(first.status, 0, first.log);
  assert.equal(s.read('github-filters.json'), GITHUB_FILTERS);
  assert.equal(s.read('filters.json'), 'mine\n');
  const second = s.sync();
  assert.equal(second.status, 0, second.log);
  const all = first.log + second.log;
  assert.equal(all.split('\n').filter((l) => l.includes('Updated the GitHub filters.')).length, 1, all);
});

test('sync removes the GitHub filters when the repo has none', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'A' });
  s.put('github-filters.json', GITHUB_FILTERS);
  const r = s.sync();
  assert.equal(r.status, 0, r.log);
  assert.ok(!s.has('github-filters.json'), 'the copy is gone');
  assert.ok(r.log.includes('Removed the GitHub filters (the repo has none).'), r.log);
});

test('sync removes the GitHub filters when the repo has no playlists folder at all', () => {
  const s = setup({});
  s.put('github-filters.json', GITHUB_FILTERS);
  const r = s.sync();
  assert.equal(r.status, 0, r.log);
  assert.ok(!s.has('github-filters.json'), 'the copy is gone');
});

test('sync keeps the GitHub filters when the repo isn\'t there', () => {
  const s = setup({ 'playlists/halloween/a.mp4': 'A', 'playlists/filters.json': GITHUB_FILTERS });
  s.put('github-filters.json', GITHUB_FILTERS);
  s.put('halloween/a.mp4', 'A');
  const moved = path.join(s.dir, 'moved-away');
  const plain = path.join(s.dir, 'plain');
  fs.mkdirSync(plain);
  for (const repo of [moved, plain]) {
    const r = s.sync([], { VIDEO_SCHEDULER_REPO: repo });
    assert.equal(r.status, 0, r.log);
    assert.equal(s.read('github-filters.json'), GITHUB_FILTERS, 'kept for ' + repo);
    assert.equal(s.read('halloween/a.mp4'), 'A', 'videos left alone');
    assert.ok(!s.has('.removed/halloween/a.mp4'), 'nothing set aside');
    assert.ok(r.log.includes('Keeping the GitHub filters: ' + repo + " isn't a git checkout."), r.log);
    assert.ok(!r.log.includes('Removed the GitHub filters'), r.log);
  }
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
