// Tests for reading the tilt switch (scheduler/tilt.js), run with Node:
//   node scheduler/tests/tilt.test.js
'use strict';
const assert = require('assert');
const { readTiltSwitch } = require('../tilt.js');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('the box reads the tilt switch with the pin pulled up', async () => {
  const runs = [];
  const answering = (out) => async (cmd, args) => { runs.push([cmd].concat(args).join(' ')); return { stdout: out }; };
  assert.equal(await readTiltSwitch(17, answering('0\n')), 'closed');
  assert.deepEqual(runs, ['gpioget --bias=pull-up --numeric GPIO17']);
  assert.equal(await readTiltSwitch(17, answering('1\n')), 'open');
  await assert.rejects(readTiltSwitch(17, answering('"GPIO17"=active\n')), /GPIO17/);
  await assert.rejects(readTiltSwitch(17, async () => { throw new Error('spawn gpioget ENOENT'); }), /ENOENT/);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL: ' + name + '\n  ' + e.message); process.exitCode = 1; }
  }
  console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
})();
