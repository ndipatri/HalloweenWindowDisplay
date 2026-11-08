# Tasks

## 1. Hide the GitHub filters' tags from Play

- [x] 1.1 `choices()` in `scheduler/website.js` leaves out every tag a GitHub filter names (any of or except). Verify: "the website lists the tags as choices" in `website.test.js` passes, and fails with the change reverted.
- [x] 1.2 README and the window-display-schedule skill say Play's tags leave out the GitHub filters' tags. Verify: the text reads so.
- [x] 1.3 On the emulator, Play's tags show Kaiju/Uploads-style tags but not Halloween, Halloween grownup or Thanksgiving. Verify: `GET /api/choices` and the page.

## Workflow follow-up

- After the PR is merged, on the box: `cd ~/HalloweenWindowDisplay && git pull && sudo bash scheduler/setup.sh`, then check the website.
