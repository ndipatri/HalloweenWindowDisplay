#!/usr/bin/env node
// Checks that every OpenSpec scenario is enforced by a test of the same name.
//
//   node openspec/check-scenarios.js            the main specs and every change in progress
//   node openspec/check-scenarios.js <change>   the main specs and that change
//
// A scenario `#### Scenario: <name>` is enforced by `test('<name>', ...)` in a
// scheduler/tests/*.test.js file, matched character for character. Scenarios
// under REMOVED or RENAMED in a change's delta specs are not checked. Exits 1
// and lists what is missing when any scenario has no test, or when two
// scenarios share a name.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function specFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return specFiles(p);
    return e.name === 'spec.md' ? [p] : [];
  });
}

// Scenario names in a spec file, skipping REMOVED and RENAMED sections.
function scenariosIn(file) {
  const found = [];
  let skipping = false;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const section = /^##\s+(\S+)/.exec(line);
    if (section && !line.startsWith('###')) skipping = /^(REMOVED|RENAMED)$/i.test(section[1]);
    const s = /^####\s+Scenario:\s*(.+?)\s*$/.exec(line);
    if (s && !skipping) found.push({ name: s[1], file, line: i + 1 });
  });
  return found;
}

// Test names declared with test('<name>', ...) in scheduler/tests/*.test.js.
function testNames(root) {
  const dir = path.join(root, 'scheduler', 'tests');
  const names = new Set();
  if (!fs.existsSync(dir)) return names;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.test.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const re = /\btest\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    let m;
    while ((m = re.exec(src))) names.add(m[2].replace(/\\(.)/g, '$1'));
  }
  return names;
}

// Returns { scenarios, missing, duplicates } for the main specs plus the given
// changes (all changes in progress when `changes` is omitted).
function check({ root = ROOT, changes } = {}) {
  const changesDir = path.join(root, 'openspec', 'changes');
  if (changes === undefined) {
    changes = fs.existsSync(changesDir)
      ? fs.readdirSync(changesDir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && e.name !== 'archive')
          .map((e) => e.name)
      : [];
  }
  const files = [
    ...specFiles(path.join(root, 'openspec', 'specs')),
    ...changes.flatMap((c) => {
      const dir = path.join(changesDir, c);
      if (!fs.existsSync(dir)) throw new Error(`No change named "${c}" in openspec/changes/`);
      return specFiles(path.join(dir, 'specs'));
    }),
  ];
  const scenarios = files.flatMap(scenariosIn);
  const tests = testNames(root);
  const missing = scenarios.filter((s) => !tests.has(s.name));
  // A modified scenario appears in both the main spec and the change's delta,
  // so a name is only a duplicate when it repeats within one of those.
  const seen = new Map();
  const duplicates = [];
  for (const s of scenarios) {
    const scope = s.file.includes(`${path.sep}changes${path.sep}`)
      ? s.file.split(`${path.sep}changes${path.sep}`)[1].split(path.sep)[0]
      : 'main';
    const key = `${scope}\u0000${s.name}`;
    if (seen.has(key)) duplicates.push(s);
    else seen.set(key, s);
  }
  return { scenarios, missing, duplicates };
}

module.exports = { check };

if (require.main === module) {
  const args = process.argv.slice(2);
  let result;
  try {
    result = check({ changes: args.length ? args : undefined });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const { scenarios, missing, duplicates } = result;
  const where = (s) => `${path.relative(ROOT, s.file)}:${s.line}`;
  for (const s of missing) console.error(`No test named "${s.name}" (${where(s)})`);
  for (const s of duplicates) console.error(`Scenario name used twice: "${s.name}" (${where(s)})`);
  if (missing.length || duplicates.length) {
    console.error('Each scenario needs a test(\'<scenario name>\', ...) in scheduler/tests/*.test.js.');
    process.exit(1);
  }
  console.log(`All ${scenarios.length} scenario(s) have a test of the same name.`);
}
