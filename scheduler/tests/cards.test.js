// Tests for the card maker's decisions (cards/cloud-init.js), run with Node:
//   node scheduler/tests/cards.test.js
// The card files are read back with a real YAML parser (python3 with PyYAML,
// which cloud-init itself uses), as the box would read them.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const cards = require('../../cards/cloud-init.js');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// Parses YAML the way cloud-init does.
function yaml(text) {
  const out = execFileSync('python3', ['-c',
    'import sys, json, yaml; print(json.dumps(yaml.safe_load(sys.stdin.read())))'], { input: text });
  return JSON.parse(out.toString());
}

const ANSWERS = {
  user: 'nick',
  password: 'Spooky Window 2026!',
  wifi: { ssid: 'Pumpkin Patch', password: 'hunter22', country: 'US' },
  timezone: 'America/New_York',
  sshKey: null,
  repoUrl: 'https://github.com/ndipatri/tvBox.git',
};
const prepared = cards.prepareAnswers(ANSWERS);
const card = (name, more = {}) => cards.buildCard(Object.assign({}, prepared, more), name);
const userOf = (ud) => ud.users.find((u) => u.name === 'nick');

// ---- The card names the box, its user and time zone ----

test("the card's user-data names the box, the user and the time zone", () => {
  const files = card('tvbox2');
  assert.ok(files['user-data'].startsWith('#cloud-config\n'));
  const ud = yaml(files['user-data']);
  assert.equal(ud.hostname, 'tvbox2');
  assert.equal(ud.timezone, 'America/New_York');
  const u = userOf(ud);
  for (const g of ['sudo', 'video', 'render']) assert.ok(u.groups.split(',').includes(g), g);
  assert.equal(u.lock_passwd, false);
  assert.equal(ud.ssh_pwauth, true);
  assert.equal(ud.enable_ssh, true);
});

test('each card gets its own instance id', () => {
  const a = yaml(card('tvbox')['meta-data']);
  const b = yaml(card('tvbox2')['meta-data']);
  assert.equal(a.dsmode, 'local');
  assert.ok(a.instance_id.startsWith('tvbox-'), a.instance_id);
  assert.ok(b.instance_id.startsWith('tvbox2-'), b.instance_id);
  assert.notEqual(a.instance_id, b.instance_id);
});

test('an SSH key is added when one is given', () => {
  const key = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKqTestKeyOnlyForTheTests nick@mac';
  const u = userOf(yaml(card('tvbox', { sshKey: key })['user-data']));
  assert.deepEqual(u.ssh_authorized_keys, [key]);
});

// ---- The password is stored only as a hash ----

test("the user's password is on the card only as a SHA-512 hash", () => {
  const files = card('tvbox');
  for (const [name, text] of Object.entries(files)) {
    assert.ok(!text.includes('Spooky Window 2026!'), name + ' has the password');
  }
  assert.ok(!JSON.stringify(prepared).includes('Spooky Window 2026!'), 'answers kept the password');
  const hash = userOf(yaml(files['user-data'])).passwd;
  assert.match(hash, /^\$6\$[./0-9A-Za-z]{16}\$[./0-9A-Za-z]{86}$/);
  assert.ok(cards.checkSha512Crypt('Spooky Window 2026!', hash));
  assert.ok(!cards.checkSha512Crypt('spooky window 2026!', hash));
});

test('the password hash is one Linux accepts', () => {
  assert.equal(cards.sha512Crypt('Hello world!', 'saltstring'),
    '$6$saltstring$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaS35inz1');
  assert.equal(cards.sha512Crypt('Hello world!', 'saltstringsaltstring', 10000),
    '$6$rounds=10000$saltstringsaltst$OW1/O6BYHV6BcXZu8QVeXbDWra3Oeqh0sbHbbMCVNSnCM/UrjmM0Dp8vOuZeHBy/YTBmSK6H9qs/y3RnOaw5v.');
});

// ---- The card joins the Wi-Fi ----

test("the card's network-config joins the Wi-Fi with the right country", () => {
  const net = yaml(card('tvbox')['network-config']).network;
  assert.equal(net.version, 2);
  assert.equal(net.wifis.renderer, 'NetworkManager');
  const w = net.wifis.wlan0;
  assert.equal(w.dhcp4, true);
  assert.equal(w['regulatory-domain'], 'US');
  assert.deepEqual(w['access-points'], { 'Pumpkin Patch': { password: 'hunter22' } });
  assert.equal(net.ethernets.eth0.dhcp4, true);
});

test('a Wi-Fi name or password with quotes and colons is written safely', () => {
  const ssid = 'Nick\'s "Net": 5G';
  const password = 'a:b"c\\d #e';
  const p = cards.prepareAnswers(Object.assign({}, ANSWERS, { wifi: { ssid, password, country: 'US' } }));
  const w = yaml(cards.buildCard(p, 'tvbox')['network-config']).network.wifis.wlan0;
  assert.deepEqual(Object.keys(w['access-points']), [ssid]);
  assert.equal(w['access-points'][ssid].password, password);
});

// ---- The box sets itself up on first boot ----

test('the card sets the box up on first boot', () => {
  const ud = yaml(card('tvbox')['user-data']);
  const file = (p) => ud.write_files.find((f) => f.path === p);
  const conf = file('/etc/tvbox/firstboot.conf');
  assert.ok(conf.content.includes('TVBOX_USER="nick"'), conf.content);
  assert.ok(conf.content.includes('TVBOX_REPO_URL="https://github.com/ndipatri/tvBox.git"'), conf.content);
  assert.ok(conf.content.includes('TVBOX_TIMEZONE="America/New_York"'), conf.content);
  const script = file('/usr/local/sbin/tvbox-firstboot');
  assert.equal(script.content, fs.readFileSync(path.join(__dirname, '../../cards/firstboot.sh'), 'utf8'));
  assert.ok(script.content.includes('repo="$home/tvBox"'), 'clones into ~/tvBox');
  assert.ok(fs.readFileSync(path.join(__dirname, '../../cards/make-cards.js'), 'utf8')
    .includes("const DEFAULT_REPO = 'https://github.com/ndipatri/tvBox.git';"), 'offers ndipatri/tvBox');
  assert.equal(script.permissions, '0755');
  const unit = file('/etc/systemd/system/tvbox-firstboot.service').content;
  for (const line of ['Restart=on-failure', 'ConditionPathExists=!/var/lib/tvbox/firstboot-done',
    'ExecStart=/usr/local/sbin/tvbox-firstboot', 'StartLimitIntervalSec=0']) {
    assert.ok(unit.includes(line), line);
  }
  assert.deepEqual(ud.runcmd, [
    ['systemctl', 'daemon-reload'],
    ['systemctl', 'enable', 'tvbox-firstboot.service'],
    ['systemctl', 'start', '--no-block', 'tvbox-firstboot.service'],
  ]);
});

// ---- Box names ----

test('box names are numbered tvbox, tvbox2, tvbox3', () => {
  assert.deepEqual([1, 2, 3].map(cards.defaultName), ['tvbox', 'tvbox2', 'tvbox3']);
});

test("a box name that isn't a valid host name is refused", () => {
  for (const bad of ['TV Box', '-tvbox', 'tvbox-', 'tv_box', '', 'a'.repeat(64)]) {
    assert.equal(cards.isValidName(bad), false, JSON.stringify(bad));
  }
  for (const good of ['tvbox', 'tvbox2', 'front-window']) assert.equal(cards.isValidName(good), true, good);
});

// ---- Answers the box can use ----

test("answers that Linux or the Wi-Fi can't use are refused", () => {
  for (const bad of ['Nick', '1nick', 'nick smith', '']) assert.equal(cards.isValidUser(bad), false, JSON.stringify(bad));
  for (const good of ['nick', '_svc', 'pi-user']) assert.equal(cards.isValidUser(good), true, good);
  for (const bad of ['USA', 'U', '1A']) assert.equal(cards.countryCode(bad), null, bad);
  assert.equal(cards.countryCode('US'), 'US');
  assert.equal(cards.countryCode('gb'), 'GB');
});

// ---- Only SD cards can be written, and only once confirmed ----

// diskutil info -plist, as plutil -convert json gives it.
const GB = 1e9;
const disk = (id, size, more = {}) => Object.assign({
  DeviceIdentifier: id, WholeDisk: true, Internal: false, VirtualOrPhysical: 'Physical',
  Size: size, MediaName: 'Media', BusProtocol: 'USB',
}, more);

test('only external, physical, SD-card-sized disks are offered', () => {
  const disks = [
    disk('disk0', 128 * GB, { Internal: true, MediaName: 'APPLE SSD', BusProtocol: 'Apple Fabric', RemovableMedia: false, Ejectable: false }),
    disk('disk4', 64 * GB, { MediaName: 'SD Card Reader', BusProtocol: 'Secure Digital' }),
    disk('disk5', 2000 * GB, { MediaName: 'Backup Drive' }),
    disk('disk6', 32 * GB, { VirtualOrPhysical: 'Virtual', MediaName: 'Disk Image' }),
    disk('disk7', 1 * GB, { MediaName: 'Tiny Stick' }),
  ];
  // On APFS the start-up disk is a synthesized container, not disk0.
  assert.deepEqual(cards.pickCards(disks, ['disk3']).map((d) => d.DeviceIdentifier), ['disk4']);
});

test("a card in the Mac's own SD card slot is offered", () => {
  const slot = disk('disk4', 32 * GB, {
    Internal: true, RemovableMedia: true, Ejectable: true, BusProtocol: 'Secure Digital', MediaName: 'SDXC Reader',
  });
  assert.deepEqual(cards.pickCards([slot], ['disk3']).map((d) => d.DeviceIdentifier), ['disk4']);
});

test('the disk the Mac runs from is never offered', () => {
  // diskutil info -plist / and diskutil apfs list -plist, as JSON.
  const root = { DeviceIdentifier: 'disk5s1', ParentWholeDisk: 'disk5' };
  const apfs = { Containers: [
    { ContainerReference: 'disk3', PhysicalStores: [{ DeviceIdentifier: 'disk0s2' }] },
    { ContainerReference: 'disk5', PhysicalStores: [{ DeviceIdentifier: 'disk2s2' }] },
  ] };
  const boot = cards.bootWholeDisks(root, apfs);
  assert.deepEqual(boot.sort(), ['disk2', 'disk5']);
  const disks = [disk('disk2', 128 * GB, { MediaName: 'External Boot' }), disk('disk4', 64 * GB)];
  assert.deepEqual(cards.pickCards(disks, boot).map((d) => d.DeviceIdentifier), ['disk4']);
});

test("writing needs the disk's name typed back", () => {
  assert.equal(cards.confirms('disk4', 'disk4'), true);
  assert.equal(cards.confirms(' disk4 ', 'disk4'), true);
  assert.equal(cards.confirms('disk5', 'disk4'), false);
  assert.equal(cards.confirms('yes', 'disk4'), false);
});

// ---- The download is checked ----

test("a download that doesn't match its checksum is refused", async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cards-')), 'image.img.xz');
  fs.writeFileSync(f, 'pretend image');
  const right = require('crypto').createHash('sha256').update('pretend image').digest('hex');
  assert.equal(await cards.checksumMatches(f, right), true);
  assert.equal(await cards.checksumMatches(f, right.replace(/^./, (c) => (c === '0' ? '1' : '0'))), false);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
