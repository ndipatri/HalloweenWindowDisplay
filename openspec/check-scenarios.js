#!/usr/bin/env node
// Checks that every OpenSpec scenario is enforced by a test of the same name.
//
//   node openspec/check-scenarios.js            the main specs and every change in progress
//   node openspec/check-scenarios.js <change>   the main specs and that change
//
// A scenario `#### Scenario: <name>` is enforced by `test('<name>', ...)` in a
// scheduler/tests/*.test.js file, matched character for character. Scenarios
// under REMOVED or RENAMED in a change's delta specs are not checked, nor
// are a main spec's scenarios under a requirement that a change in progress
// removes (the removal lands when it is archived). Exits 1
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

// Scenario names in a spec file, skipping REMOVED and RENAMED sections and
// any requirement named in `removed` (a Set).
function scenariosIn(file, removed = new Set()) {
  const found = [];
  let skipping = false;
  let requirement = null;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const section = /^##\s+(\S+)/.exec(line);
    if (section && !line.startsWith('###')) skipping = /^(REMOVED|RENAMED)$/i.test(section[1]);
    const req = /^###\s+Requirement:\s*(.+?)\s*$/.exec(line);
    if (req) requirement = req[1];
    const s = /^####\s+Scenario:\s*(.+?)\s*$/.exec(line);
    if (s && !skipping && !removed.has(requirement)) found.push({ name: s[1], file, line: i + 1 });
  });
  return found;
}

// Requirements removed by the changes in progress, by capability path
// ('box-player' -> Set of requirement names).
function removedRequirements(changesDir, changes) {
  const removed = new Map();
  for (const c of changes) {
    const specsDir = path.join(changesDir, c, 'specs');
    for (const file of specFiles(specsDir)) {
      const capability = path.relative(specsDir, path.dirname(file));
      let inRemoved = false;
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const section = /^##\s+(\S+)/.exec(line);
        if (section && !line.startsWith('###')) inRemoved = /^REMOVED$/i.test(section[1]);
        const req = /^###\s+Requirement:\s*(.+?)\s*$/.exec(line);
        if (req && inRemoved) {
          if (!removed.has(capability)) removed.set(capability, new Set());
          removed.get(capability).add(req[1]);
        }
      }
    }
  }
  return removed;
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
  const inProgress = fs.existsSync(changesDir)
    ? fs.readdirSync(changesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== 'archive')
        .map((e) => e.name)
    : [];
  if (changes === undefined) changes = inProgress;
  const mainDir = path.join(root, 'openspec', 'specs');
  // Removals pending in any change in progress apply to the main specs,
  // even when only the main specs are checked.
  const removed = removedRequirements(changesDir, inProgress);
  const mainScenarios = specFiles(mainDir).flatMap((f) =>
    scenariosIn(f, removed.get(path.relative(mainDir, path.dirname(f)))));
  const changeScenarios = changes.flatMap((c) => {
    const dir = path.join(changesDir, c);
    if (!fs.existsSync(dir)) throw new Error(`No change named "${c}" in openspec/changes/`);
    return specFiles(path.join(dir, 'specs')).map((f) => scenariosIn(f));
  }).flat();
  const scenarios = mainScenarios.concat(changeScenarios);
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
