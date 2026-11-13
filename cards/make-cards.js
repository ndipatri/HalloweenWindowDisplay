#!/usr/bin/env node
// Makes SD cards for tvboxes, on a Mac. Asks the questions once (Wi-Fi,
// user, password, time zone), downloads the latest Raspberry Pi OS Lite
// (64-bit) and checks it, then for each card: asks the box's name, finds the
// SD card, has you type its name to confirm, writes the OS to it, and adds
// the first-boot files. Put a card in a Pi plugged into the TV, power it on,
// and it sets itself up (it takes 10-20 minutes the first time).
//
//   node cards/make-cards.js
//
// Needs Node.js 18+, xz (brew install xz) or python3 to unpack the image,
// and your Mac password for sudo (writing to a card needs it).
//
// For testing on Linux, without a card: write a finished card image to a
// file instead, with the answers from a JSON file (it holds the password,
// so keep it out of the repo):
//   node cards/make-cards.js --to-file card.img --answers answers.json [--image raspios.img.xz]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { spawn, spawnSync, execFileSync } = require('child_process');
const cards = require('./cloud-init.js');

const LATEST = 'https://downloads.raspberrypi.com/raspios_lite_arm64_latest';
const DEFAULT_REPO = 'https://github.com/ndipatri/tvBox.git';
const CACHE = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Caches', 'tvbox')
  : path.join(os.homedir(), '.cache', 'tvbox');

const say = (s = '') => process.stdout.write(s + '\n');
const fail = (s) => { console.error('\n' + s); process.exit(1); };

// ---------- Questions ----------

function asker() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let hiding = false;
  const write = rl._writeToOutput.bind(rl);
  rl._writeToOutput = (s) => { if (!hiding || s.includes('\n') || s.includes('\r')) write(hiding ? '\n' : s); };
  const ask = (question, { def, hidden, check } = {}) => new Promise((resolve) => {
    const prompt = question + (def ? ' [' + def + ']' : '') + ': ';
    hiding = false;
    rl.question(prompt, (answer) => {
      hiding = false;
      const value = answer === '' && def !== undefined ? def : answer;
      const problem = check ? check(value) : null;
      if (problem) { say('  ' + problem); resolve(ask(question, { def, hidden, check })); } else resolve(value);
    });
    if (hidden) hiding = true;
  });
  return { ask, close: () => rl.close() };
}

async function askAnswers(ask) {
  say('These are the same for every card in this run.\n');
  const ssid = await ask('Wi-Fi network name', { check: (v) => (v ? null : 'Type the Wi-Fi network name.') });
  const wifiPassword = await ask('Wi-Fi password (blank for an open network)', { hidden: true });
  const country = cards.countryCode(await ask('Wi-Fi country (two letters)', {
    def: 'US', check: (v) => (cards.countryCode(v) ? null : 'Two letters, like US or GB.'),
  }));
  const user = await ask('Username on the boxes', {
    def: (os.userInfo().username || 'pi').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'pi',
    check: (v) => (cards.isValidUser(v) ? null : 'Lowercase letters, digits, - and _; starting with a letter.'),
  });
  let password;
  for (;;) {
    password = await ask('Password for ' + user, { hidden: true, check: (v) => (v.length >= 8 ? null : 'At least 8 characters.') });
    if ((await ask('Password again', { hidden: true })) === password) break;
    say('  Those didn\'t match. Try again.');
  }
  const timezone = await ask('Time zone', {
    def: 'America/New_York',
    check: (v) => (fs.existsSync('/usr/share/zoneinfo/' + v) ? null : 'Not a time zone this Mac knows, like America/New_York.'),
  });
  let sshKey = null;
  const keyFile = ['id_ed25519.pub', 'id_ecdsa.pub', 'id_rsa.pub']
    .map((f) => path.join(os.homedir(), '.ssh', f)).find((f) => fs.existsSync(f));
  if (keyFile && /^y/i.test(await ask('Also let ' + path.basename(keyFile) + ' log in without a password? (y/n)', { def: 'y' }))) {
    sshKey = fs.readFileSync(keyFile, 'utf8').trim();
  }
  const repoUrl = await ask('Repo the boxes play from', { def: DEFAULT_REPO });
  return { user, password, wifi: { ssid, password: wifiPassword, country }, timezone, sshKey, repoUrl };
}

// ---------- The image ----------

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => resolve(res)).on('error', reject).setTimeout(30000, function () { this.destroy(new Error('timed out')); });
  });
}

async function text(url) {
  const res = await get(url);
  if (res.statusCode !== 200) { res.resume(); throw new Error(url + ': HTTP ' + res.statusCode); }
  let body = '';
  for await (const chunk of res) body += chunk;
  return body;
}

// The latest image's URL, name and published SHA-256.
async function latest() {
  const res = await get(LATEST);
  res.resume();
  const url = res.headers.location;
  if (!url) throw new Error('no redirect from ' + LATEST);
  const sha = (await text(url + '.sha256')).trim().split(/\s+/)[0];
  return { url, name: path.basename(url), sha };
}

async function download(url, file) {
  const res = await get(url);
  if (res.statusCode !== 200) { res.resume(); throw new Error(url + ': HTTP ' + res.statusCode); }
  const total = Number(res.headers['content-length']) || 0;
  let got = 0;
  const out = fs.createWriteStream(file);
  res.on('data', (d) => { got += d.length; progress('Downloading', got, total); });
  await new Promise((resolve, reject) => { res.pipe(out); out.on('finish', resolve); res.on('error', reject); out.on('error', reject); });
  say();
}

// The checked image (.img.xz), downloaded if needed. Kept for the next run.
async function getImage() {
  fs.mkdirSync(CACHE, { recursive: true });
  let want;
  try {
    want = await latest();
  } catch (e) {
    const cached = fs.readdirSync(CACHE).filter((f) => f.endsWith('.img.xz')).sort().pop();
    if (!cached) throw new Error("Can't reach downloads.raspberrypi.com (" + e.message + '), and no image is saved yet.');
    say("Can't check for a newer Raspberry Pi OS (" + e.message + '); using the saved ' + cached + '.');
    want = { name: cached, sha: fs.readFileSync(path.join(CACHE, cached + '.sha256'), 'utf8').trim() };
  }
  const file = path.join(CACHE, want.name);
  if (fs.existsSync(file) && await cards.checksumMatches(file, want.sha)) {
    say('Raspberry Pi OS: ' + want.name + ' (saved, checksum OK)');
    return file;
  }
  if (!want.url) throw new Error('The saved image ' + want.name + " doesn't match its checksum, and there's no network to get it again.");
  say('Raspberry Pi OS: ' + want.name);
  await download(want.url, file + '.part');
  if (!(await cards.checksumMatches(file + '.part', want.sha))) {
    fs.rmSync(file + '.part', { force: true });
    throw new Error("The download doesn't match Raspberry Pi's checksum, so it won't be used. Try again.");
  }
  fs.renameSync(file + '.part', file);
  fs.writeFileSync(file + '.sha256', want.sha + '\n');
  for (const f of fs.readdirSync(CACHE)) {
    if (f.endsWith('.img.xz') && f !== want.name) { fs.rmSync(path.join(CACHE, f)); fs.rmSync(path.join(CACHE, f + '.sha256'), { force: true }); }
  }
  say('Checksum OK.');
  return file;
}

// A process that unpacks .xz from stdin to stdout: xz, or python3's lzma.
function unpacker() {
  if (spawnSync('xz', ['--version']).status === 0) return spawn('xz', ['-dc'], { stdio: ['pipe', 'pipe', 'inherit'] });
  if (spawnSync('python3', ['-c', 'import lzma']).status === 0) {
    return spawn('python3', ['-c', 'import lzma, shutil, sys; shutil.copyfileobj(lzma.open(sys.stdin.buffer), sys.stdout.buffer, 4 << 20)'],
      { stdio: ['pipe', 'pipe', 'inherit'] });
  }
  fail('To unpack the image, install xz (brew install xz) or Python 3.');
}

// Unpacks `xzFile` into the stdin of `sink` (a spawned process), showing
// progress. Resolves when both have finished well.
function unpackInto(xzFile, sink, label) {
  const total = fs.statSync(xzFile).size;
  const unpack = unpacker();
  let read = 0;
  const input = fs.createReadStream(xzFile);
  input.on('data', (d) => { read += d.length; progress(label, read, total); });
  input.pipe(unpack.stdin);
  unpack.stdout.pipe(sink.stdin);
  const done = (p, name) => new Promise((resolve, reject) =>
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(name + ' failed (exit ' + code + ')')))));
  return Promise.all([done(unpack, 'Unpacking'), done(sink, 'Writing')]).then(() => say());
}

function progress(label, n, total) {
  if (!process.stdout.isTTY) return;
  const pct = total ? Math.floor((n / total) * 100) + '%' : Math.round(n / 1e6) + ' MB';
  process.stdout.write('\r' + label + ': ' + pct + '   ');
}

// ---------- Cards on a Mac ----------

function plist(args) {
  const xml = execFileSync('diskutil', args);
  return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], { input: xml }).toString());
}

function findCards() {
  // All physical disks: a card in a MacBook's own SD slot counts as internal.
  const list = plist(['list', '-plist', 'physical']);
  const disks = (list.WholeDisks || []).map((id) => plist(['info', '-plist', id]));
  let apfs = null;
  try { apfs = plist(['apfs', 'list', '-plist']); } catch (e) { /* no APFS: the root's own disk is enough */ }
  const boot = cards.bootWholeDisks(plist(['info', '-plist', '/']), apfs);
  return cards.pickCards(disks, boot);
}

const describe = (d) => d.DeviceIdentifier + '  ' + ((d.Size || d.TotalSize) / 1e9).toFixed(1) + ' GB  ' +
  (d.MediaName || 'unnamed') + (d.BusProtocol ? ' (' + d.BusProtocol + ')' : '');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(cmd + ' ' + args.join(' ') + ' failed');
}

async function bootMount(id) {
  for (let i = 0; i < 30; i++) {
    try {
      const mp = plist(['info', '-plist', id + 's1']).MountPoint;
      if (mp) return mp;
    } catch (e) { /* not there yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("The card's boot partition didn't appear.");
}

async function makeCardOnMac(ask, image, prepared, name) {
  let found;
  for (;;) {
    found = findCards();
    if (found.length) break;
    if (/^q/i.test(await ask('No SD card found. Put the card for ' + name + ' in, then press Enter (q to stop)', { def: '' }))) return false;
  }
  say('\nSD cards:');
  for (const d of found) say('  ' + describe(d));
  let chosen = found[0];
  if (found.length > 1) {
    const id = await ask('Which one?', { check: (v) => (found.some((d) => d.DeviceIdentifier === v.trim()) ? null : 'Type one of the names above.') });
    chosen = found.find((d) => d.DeviceIdentifier === id.trim());
  }
  const id = chosen.DeviceIdentifier;
  const typed = await ask('\nEverything on ' + describe(chosen) + ' will be erased.\nType ' + id + ' to make the card for ' + name);
  if (!cards.confirms(typed, id)) { say("That didn't match " + id + '. Nothing was written.'); return true; }

  say('Your Mac password lets it write to the card.');
  run('sudo', ['-v']);
  run('diskutil', ['unmountDisk', '/dev/' + id]);
  const dd = spawn('sudo', ['dd', 'of=/dev/r' + id, 'bs=4m'], { stdio: ['pipe', 'ignore', 'ignore'] });
  await unpackInto(image, dd, 'Writing ' + name);
  run('sync', []);
  say("If macOS offers to initialise or says the disk isn't readable, choose Ignore.");
  run('diskutil', ['mountDisk', '/dev/' + id]);
  const mp = await bootMount(id);
  for (const [file, content] of Object.entries(cards.buildCard(prepared, name))) fs.writeFileSync(path.join(mp, file), content);
  run('sync', []);
  run('diskutil', ['eject', '/dev/' + id]);
  say('\nThe card for ' + name + ' is ready: http://' + name + '.local/ once the box is up.');
  return true;
}

// ---------- A card image in a file (Linux, for testing) ----------

async function makeCardFile(image, prepared, name, out) {
  if (spawnSync('mcopy', ['--version']).status !== 0) fail('--to-file needs mtools (apt-get install mtools).');
  const sink = spawn('dd', ['of=' + out, 'bs=4M', 'status=none'], { stdio: ['pipe', 'inherit', 'inherit'] });
  await unpackInto(image, sink, 'Unpacking ' + name);
  // The first partition (bootfs, FAT) from the MBR.
  const fd = fs.openSync(out, 'r');
  const mbr = Buffer.alloc(512);
  fs.readSync(fd, mbr, 0, 512, 0);
  fs.closeSync(fd);
  const offset = mbr.readUInt32LE(446 + 8) * 512;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvbox-card-'));
  for (const [file, content] of Object.entries(cards.buildCard(prepared, name))) {
    fs.writeFileSync(path.join(dir, file), content);
    execFileSync('mcopy', ['-o', '-i', out + '@@' + offset, path.join(dir, file), '::/' + file], { env: Object.assign({}, process.env, { MTOOLS_SKIP_CHECK: '1' }) });
  }
  fs.rmSync(dir, { recursive: true });
  say('Card image for ' + name + ': ' + out);
}

// ---------- Main ----------

async function main() {
  const args = process.argv.slice(2);
  const opt = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('-h') || args.includes('--help')) {
    say(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }
  if (Number(process.versions.node.split('.')[0]) < 18) fail('This needs Node.js 18 or later (brew install node).');
  const toFile = opt('--to-file');
  const answersFile = opt('--answers');

  if (toFile) {
    if (!answersFile) fail('--to-file needs --answers <json>.');
    const raw = JSON.parse(fs.readFileSync(answersFile, 'utf8'));
    const image = opt('--image') || await getImage();
    await makeCardFile(image, cards.prepareAnswers(raw), raw.name || cards.defaultName(1), toFile);
    return;
  }

  if (process.platform !== 'darwin') fail('Writing cards needs a Mac. On Linux, --to-file makes a card image (see --help).');
  say('tvbox cards\n===========\n');
  const { ask, close } = asker();
  try {
    const prepared = cards.prepareAnswers(await askAnswers(ask));
    say();
    const image = await getImage();
    for (let n = 1; ; n++) {
      const name = await ask('\nName for this box', {
        def: cards.defaultName(n),
        check: (v) => (cards.isValidName(v) ? null : 'Lowercase letters, digits and -, like tvbox or front-window.'),
      });
      if (!(await makeCardOnMac(ask, image, prepared, name))) break;
      if (/^n/i.test(await ask('\nMake another card? (y/n)', { def: 'y' }))) break;
    }
    say('\nDone. Put each card in a Pi plugged into the TV and power it on. It sets itself up in 10-20 minutes.');
  } finally {
    close();
  }
}

main().catch((e) => fail('Stopped: ' + e.message));
