// Enforces the OpenSpec specs: every scenario in openspec/specs/ must have a
// test of the same name in scheduler/tests/*.test.js. Run with Node:
//   node scheduler/tests/specs.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { check } = require('../../openspec/check-scenarios.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

// Builds a throwaway project: `files` maps relative paths to contents.
function project(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specs-test-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

test('every scenario in the main specs has a test of the same name', () => {
  const { missing, duplicates } = check({ changes: [] });
  const where = (s) => `"${s.name}" (${path.relative(path.join(__dirname, '..', '..'), s.file)}:${s.line})`;
  assert.equal(missing.length, 0, 'no test named ' + missing.map(where).join(', '));
  assert.equal(duplicates.length, 0, 'scenario name used twice: ' + duplicates.map(where).join(', '));
});

// ---- The check itself ----

const SPEC = `## ADDED Requirements

### Requirement: Something
The system SHALL do it.

#### Scenario: covered thing
- **WHEN** x
- **THEN** y

#### Scenario: uncovered thing
- **WHEN** x
- **THEN** y

## REMOVED Requirements

### Requirement: Old
#### Scenario: removed thing
- **WHEN** x
- **THEN** y
`;

test('the check reports scenarios with no test and skips removed ones', () => {
  const root = project({
    'openspec/changes/demo/specs/thing/spec.md': SPEC,
    'scheduler/tests/a.test.js': "test('covered thing', () => {});\n",
  });
  const { scenarios, missing } = check({ root });
  assert.deepEqual(scenarios.map((s) => s.name), ['covered thing', 'uncovered thing']);
  assert.deepEqual(missing.map((s) => s.name), ['uncovered thing']);
});

test('the check skips a main spec requirement that a change in progress removes', () => {
  const MAIN = `### Requirement: Old\nThe system SHALL.\n\n#### Scenario: old thing\n- **WHEN** x\n- **THEN** y\n\n` +
    `### Requirement: Kept\nThe system SHALL.\n\n#### Scenario: kept thing\n- **WHEN** x\n- **THEN** y\n`;
  const root = project({
    'openspec/specs/thing/spec.md': MAIN,
    'openspec/changes/demo/specs/thing/spec.md': '## REMOVED Requirements\n\n### Requirement: Old\n**Reason**: gone\n',
    'scheduler/tests/a.test.js': '',
  });
  assert.deepEqual(check({ root, changes: [] }).missing.map((s) => s.name), ['kept thing']);
  assert.deepEqual(check({ root }).missing.map((s) => s.name), ['kept thing']);
  // Once archived (no change in progress), the main spec is checked whole.
  const archived = project({ 'openspec/specs/thing/spec.md': MAIN, 'scheduler/tests/a.test.js': '' });
  assert.deepEqual(check({ root: archived }).missing.map((s) => s.name), ['old thing', 'kept thing']);
});

test('the check matches names exactly, including quotes', () => {
  const root = project({
    'openspec/specs/thing/spec.md': "#### Scenario: Mochi's night\n#### Scenario: covered Thing\n",
    'scheduler/tests/a.test.js': "test('Mochi\\'s night', () => {});\ntest(\"covered thing\", () => {});\n",
  });
  assert.deepEqual(check({ root }).missing.map((s) => s.name), ['covered Thing']);
});

test('the check reports a scenario name used twice', () => {
  const root = project({
    'openspec/specs/a/spec.md': '#### Scenario: same name\n',
    'openspec/specs/b/spec.md': '#### Scenario: same name\n',
    'scheduler/tests/a.test.js': "test('same name', () => {});\n",
  });
  assert.deepEqual(check({ root }).duplicates.map((s) => s.name), ['same name']);
});

test('the check ignores archived changes and allows a modified scenario to repeat its main spec', () => {
  const root = project({
    'openspec/specs/a/spec.md': '#### Scenario: kept name\n',
    'openspec/changes/edit/specs/a/spec.md': '## MODIFIED Requirements\n#### Scenario: kept name\n',
    'openspec/changes/archive/old/specs/a/spec.md': '#### Scenario: archived\n',
    'scheduler/tests/a.test.js': "test('kept name', () => {});\n",
  });
  const r = check({ root });
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.duplicates, []);
});

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
