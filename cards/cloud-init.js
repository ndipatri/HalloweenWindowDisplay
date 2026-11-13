// What goes on a tvbox card, and the decisions the card maker makes: the
// cloud-init files Raspberry Pi OS reads from the card's boot partition on
// first boot, the box names, which disks may be written, and the checks.
// Pure functions (apart from reading firstboot.sh and hashing a file), so
// the tests can call them; make-cards.js does the asking and the writing.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FIRSTBOOT_SCRIPT = path.join(__dirname, 'firstboot.sh');

// The groups Raspberry Pi Imager gives the first user (all present in
// Raspberry Pi OS Lite); video and render let the box use the screen.
const USER_GROUPS = 'users,adm,dialout,audio,netdev,video,plugdev,cdrom,games,input,gpio,spi,i2c,render,sudo';

// ---------- Answers ----------

// Hashes the password once and drops it: nothing after this sees it.
// `raw`: { user, password, wifi: { ssid, password, country }, timezone,
//          sshKey (or null), repoUrl }
function prepareAnswers(raw) {
  const prepared = Object.assign({}, raw, { passwordHash: sha512Crypt(raw.password, randomSalt()) });
  delete prepared.password;
  return prepared;
}

// Box names: tvbox, tvbox2, tvbox3, ...
function defaultName(n) {
  return n === 1 ? 'tvbox' : 'tvbox' + n;
}

// A host name: 1-63 lowercase letters, digits and hyphens, no hyphen at
// either end.
function isValidName(name) {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name);
}

// A Linux user name, as Debian's adduser accepts by default.
function isValidUser(user) {
  return /^[a-z_][a-z0-9_-]{0,31}$/.test(user);
}

// A two-letter country code for the Wi-Fi's radio rules, in capitals, or
// null if it isn't one.
function countryCode(text) {
  const c = String(text).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

// ---------- The card's files ----------

// The three files for the boot partition, for the box `name`.
// `a`: prepared answers (see prepareAnswers).
function buildCard(a, name, now = new Date()) {
  return {
    'user-data': userData(a, name),
    'network-config': networkConfig(a),
    'meta-data': metaData(name, now),
  };
}

function userData(a, name) {
  const q = JSON.stringify; // a JSON string is a valid YAML double-quoted scalar
  const lines = [
    '#cloud-config',
    '# A tvbox card, made by cards/make-cards.js. On first boot, cloud-init reads',
    '# this from the card\'s boot partition and sets up the box: its name, user,',
    '# SSH and time zone, then a service that installs and starts the display.',
    '',
    'hostname: ' + q(name),
    'manage_etc_hosts: true',
    'timezone: ' + q(a.timezone),
    '',
    'users:',
    '  - name: ' + q(a.user),
    '    groups: ' + q(USER_GROUPS),
    '    shell: /bin/bash',
    '    lock_passwd: false',
    '    passwd: ' + q(a.passwordHash),
    '    sudo: ' + q('ALL=(ALL) ALL'),
  ];
  if (a.sshKey) lines.push('    ssh_authorized_keys:', '      - ' + q(a.sshKey));
  lines.push(
    '',
    'enable_ssh: true',
    'ssh_pwauth: true',
    '',
    'write_files:',
    '  - path: /etc/tvbox/firstboot.conf',
    '    permissions: "0644"',
    '    content: |',
    block([
      '# Read by /usr/local/sbin/tvbox-firstboot.',
      'TVBOX_USER=' + shellQuote(a.user),
      'TVBOX_REPO_URL=' + shellQuote(a.repoUrl),
      'TVBOX_TIMEZONE=' + shellQuote(a.timezone),
    ].join('\n') + '\n', 6),
    '  - path: /usr/local/sbin/tvbox-firstboot',
    '    permissions: "0755"',
    '    content: |',
    block(fs.readFileSync(FIRSTBOOT_SCRIPT, 'utf8'), 6),
    '  - path: /etc/systemd/system/tvbox-firstboot.service',
    '    permissions: "0644"',
    '    content: |',
    block(FIRSTBOOT_UNIT, 6),
    '',
    '# Only start the first-boot service here: it does its own waiting for the',
    '# network, and keeps trying (even after a reboot) until setup has worked.',
    'runcmd:',
    '  - [systemctl, daemon-reload]',
    '  - [systemctl, enable, tvbox-firstboot.service]',
    '  - [systemctl, start, --no-block, tvbox-firstboot.service]',
  );
  return lines.join('\n') + '\n';
}

const FIRSTBOOT_UNIT = `[Unit]
Description=tvBox first boot: install and set up the box
Wants=network-online.target
After=network-online.target
ConditionPathExists=!/var/lib/tvbox/firstboot-done
StartLimitIntervalSec=0

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/tvbox-firstboot
# Until it works: no network yet, a download that failed, ...
Restart=on-failure
RestartSec=60
# Installing packages can take a while.
TimeoutStartSec=0
StandardOutput=append:/var/log/tvbox-firstboot.log
StandardError=append:/var/log/tvbox-firstboot.log

[Install]
WantedBy=multi-user.target
`;

function networkConfig(a) {
  const q = JSON.stringify;
  const ap = a.wifi.password
    ? ['        ' + q(a.wifi.ssid) + ':', '          password: ' + q(a.wifi.password)]
    : ['        ' + q(a.wifi.ssid) + ': {}'];
  return [
    '# A tvbox card\'s network, made by cards/make-cards.js: the Wi-Fi, and wired',
    '# Ethernet if it\'s plugged in. Neither holds up the boot (optional); the',
    '# first-boot service waits for the network itself.',
    'network:',
    '  version: 2',
    '  ethernets:',
    '    eth0:',
    '      dhcp4: true',
    '      optional: true',
    '  wifis:',
    '    renderer: NetworkManager',
    '    wlan0:',
    '      dhcp4: true',
    '      optional: true',
    '      regulatory-domain: ' + q(a.wifi.country),
    '      access-points:',
    ...ap,
  ].join('\n') + '\n';
}

function metaData(name, now) {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return [
    '# A tvbox card, made by cards/make-cards.js. A new instance_id makes',
    '# cloud-init treat the card as a new box and run its first-boot setup.',
    'dsmode: local',
    'instance_id: ' + JSON.stringify(name + '-' + stamp + '-' + crypto.randomBytes(3).toString('hex')),
  ].join('\n') + '\n';
}

// Indents every line of `text` by `n` spaces, for a YAML block scalar.
function block(text, n) {
  const pad = ' '.repeat(n);
  return text.replace(/\n$/, '').split('\n').map((l) => (l === '' ? '' : pad + l)).join('\n');
}

// A value for a shell file sourced by bash: double-quoted, with \ " $ ` escaped.
function shellQuote(s) {
  return '"' + String(s).replace(/[\\"$`]/g, '\\$&') + '"';
}

// ---------- SHA-512 crypt ($6$), as Linux uses for passwords ----------
// The algorithm as published by Ulrich Drepper ("Unix crypt using SHA-256
// and SHA-512"), which glibc implements.

const B64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomSalt() {
  return Array.from(crypto.randomBytes(16), (b) => B64[b % 64]).join('');
}

function sha512Crypt(password, salt, rounds) {
  const custom = rounds !== undefined;
  const r = custom ? Math.min(Math.max(rounds, 1000), 999999999) : 5000;
  const key = Buffer.from(password, 'utf8');
  const s = Buffer.from(String(salt).slice(0, 16), 'utf8');
  const sha = (...parts) => {
    const h = crypto.createHash('sha512');
    for (const p of parts) h.update(p);
    return h.digest();
  };
  const repeatTo = (digest, length) => {
    const out = Buffer.alloc(length);
    for (let i = 0; i < length; i++) out[i] = digest[i % 64];
    return out;
  };

  const b = sha(key, s, key);
  const ctxA = crypto.createHash('sha512');
  ctxA.update(key);
  ctxA.update(s);
  ctxA.update(repeatTo(b, key.length));
  for (let i = key.length; i > 0; i >>= 1) ctxA.update(i & 1 ? b : key);
  const a = ctxA.digest();

  const dp = crypto.createHash('sha512');
  for (let i = 0; i < key.length; i++) dp.update(key);
  const p = repeatTo(dp.digest(), key.length);

  const ds = crypto.createHash('sha512');
  for (let i = 0; i < 16 + a[0]; i++) ds.update(s);
  const sBytes = repeatTo(ds.digest(), s.length);

  let c = a;
  for (let i = 0; i < r; i++) {
    const h = crypto.createHash('sha512');
    h.update(i & 1 ? p : c);
    if (i % 3) h.update(sBytes);
    if (i % 7) h.update(p);
    h.update(i & 1 ? c : p);
    c = h.digest();
  }

  const order = [
    [0, 21, 42], [22, 43, 1], [44, 2, 23], [3, 24, 45], [25, 46, 4], [47, 5, 26], [6, 27, 48],
    [28, 49, 7], [50, 8, 29], [9, 30, 51], [31, 52, 10], [53, 11, 32], [12, 33, 54], [34, 55, 13],
    [56, 14, 35], [15, 36, 57], [37, 58, 16], [59, 17, 38], [18, 39, 60], [40, 61, 19], [62, 20, 41],
  ];
  let out = '';
  const put = (b2, b1, b0, n) => {
    let w = (b2 << 16) | (b1 << 8) | b0;
    for (let i = 0; i < n; i++) { out += B64[w & 0x3f]; w >>= 6; }
  };
  for (const [x, y, z] of order) put(c[x], c[y], c[z], 4);
  put(0, 0, c[63], 2);
  return '$6$' + (custom ? 'rounds=' + r + '$' : '') + s.toString('utf8') + '$' + out;
}

// Whether `password` matches a $6$ hash.
function checkSha512Crypt(password, hash) {
  const m = /^\$6\$(?:rounds=(\d+)\$)?([^$]{0,16})\$/.exec(hash);
  if (!m) return false;
  return sha512Crypt(password, m[2], m[1] === undefined ? undefined : Number(m[1])) === hash;
}

// ---------- Disks ----------

const MIN_CARD = 4e9;
const MAX_CARD = 256e9;

// The disks that may be written: whole, physical disks of 4-256 GB that the
// Mac didn't start from, and that are external, or a card in the Mac's own
// SD slot (which macOS calls internal, but removable). The Mac's own drive
// is internal and not removable, so it is never offered. `disks`:
// `diskutil info -plist` of each, as JSON; `bootDisks`: the start-up disks,
// from bootWholeDisks.
function pickCards(disks, bootDisks) {
  const boot = [].concat(bootDisks);
  return disks.filter((d) => {
    const size = d.Size !== undefined ? d.Size : d.TotalSize;
    const builtInSlot = d.Internal === true &&
      (d.RemovableMedia === true || d.Removable === true) &&
      d.Ejectable === true && d.BusProtocol === 'Secure Digital';
    return d.WholeDisk === true &&
      (d.Internal === false || builtInSlot) &&
      d.VirtualOrPhysical === 'Physical' &&
      typeof size === 'number' && size >= MIN_CARD && size <= MAX_CARD &&
      !boot.includes(d.DeviceIdentifier);
  });
}

// The whole disks the Mac started from: the one `diskutil info -plist /`
// names (on APFS a synthesized container, like disk3), plus the whole disks
// of that container's physical stores (like disk0 for disk0s2), from
// `diskutil apfs list -plist`. Both as JSON.
function bootWholeDisks(rootInfo, apfsList) {
  const whole = (id) => String(id).replace(/s\d+$/, '');
  const boot = new Set([whole(rootInfo.ParentWholeDisk || rootInfo.DeviceIdentifier)]);
  for (const c of (apfsList && apfsList.Containers) || []) {
    if (boot.has(c.ContainerReference)) {
      for (const s of c.PhysicalStores || []) boot.add(whole(s.DeviceIdentifier));
    }
  }
  return [...boot];
}

// Whether what was typed confirms the disk `id`.
function confirms(typed, id) {
  return String(typed).trim() === id;
}

// ---------- The download ----------

// Whether a file's SHA-256 is `expected` (hex).
function checksumMatches(file, expected) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex') === String(expected).trim().toLowerCase()));
  });
}

module.exports = {
  prepareAnswers, defaultName, isValidName, isValidUser, countryCode,
  buildCard, sha512Crypt, checkSha512Crypt, randomSalt,
  pickCards, bootWholeDisks, confirms, checksumMatches, USER_GROUPS,
};
