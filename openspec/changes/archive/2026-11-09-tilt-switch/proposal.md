## Why

The box can now turn the picture for a TV turned to landscape, but someone has to tap Portrait or Landscape on the website each time the TV is turned. A tilt switch on the back of the TV, wired to the Pi, lets the box notice the turn by itself.

## What Changes

- **A new setting, `tiltSwitch`, in `config.js`.** It's off (`null`) as shipped. Once a switch is wired, it's set to `{ gpio: 17, closed: 'portrait' }`: the GPIO pin the switch is on, and which way the TV faces while the switch is closed.
- **Reading the switch.** While the setting is on, the box reads the pin every second, with the Pi's pull-up resistor on (the switch closes it to ground). It uses `gpioget` from the `gpiod` package.
- **Following it.** When the switch has held a new position for 2 seconds, the box saves the matching way (Portrait or Landscape), exactly as the website buttons do. The picture turns as it does for them, and the box logs `Screen: landscape (from the tilt switch).` A switch rattling while the TV is being turned is ignored until it settles.
- **The website buttons.** They still work. A choice made there stays until the switch next moves.
- **When the switch can't be read** (no `gpioget`, or no permission), it's logged once and ignored.
- **Setup.** It installs `gpiod` and adds the box's user to the `gpio` group.
- **README.** It explains which switch to buy, how to wire it (pin 11 and pin 9), how to mount it and how to turn it on.

## Capabilities

### Modified Capabilities

- `box-player`: a new requirement, "Follows a tilt switch on the TV".

## Impact

- **Code:** `scheduler/config.js`, `scheduler/player.js`, a new `scheduler/tilt.js`, `scheduler/setup.sh`.
- **Tests and docs:** `player.test.js`, a new `tilt.test.js`, `setup.test.js`, the rehearsal, the README, and the window-display-schedule skill.
