// Reads the tilt switch on the back of the TV: one GPIO pin, with the Pi's
// pull-up on, which the switch closes to ground. Uses gpioget from the
// gpiod package (setup installs it).
'use strict';
const { execFile } = require('child_process');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 2000 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || '').trim() || error.message));
      else resolve({ stdout });
    });
  });
}

// 'closed' (the pin reads 0, pulled to ground by the switch) or 'open' (1).
// Rejects when the pin can't be read.
async function readTiltSwitch(gpio, runner = run) {
  const { stdout } = await runner('gpioget', ['--bias=pull-up', '--numeric', 'GPIO' + gpio]);
  const value = String(stdout).trim();
  if (value === '0') return 'closed';
  if (value === '1') return 'open';
  throw new Error('GPIO' + gpio + ' read as ' + JSON.stringify(value));
}

module.exports = { readTiltSwitch };
