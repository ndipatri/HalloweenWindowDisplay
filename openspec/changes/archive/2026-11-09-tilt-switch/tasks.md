## 1. Reading the switch

- [x] 1.1 Test and `scheduler/tilt.js`: `gpioget --bias=pull-up --numeric GPIO<n>`; 0 is closed, 1 is open, and anything else can't be read

## 2. Following it

- [x] 2.1 Tests: follows a settled switch; ignores a flicker; the website's choice stays until the switch moves; no switch set, no reads; a switch that can't be read is logged once
- [x] 2.2 `tiltSwitch` in config; the player reads it each tick and saves the way it says

## 3. Setup and docs

- [x] 3.1 Setup installs `gpiod` and adds the user to `gpio` (test, and a rehearsal check)
- [x] 3.2 README wiring and turning it on; the skill
