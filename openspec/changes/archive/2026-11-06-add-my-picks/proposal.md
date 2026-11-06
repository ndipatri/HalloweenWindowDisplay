# Proposal

## Why

The website can play a whole season, a season's playlist, or all the phone uploads, but not a chosen handful: there is no way to say "just the Mochi videos and these two photos tonight". The person wants one place on the page to pick from everything already on the box, the playlist videos and the uploads alike, and play those.

## What Changes

- **My picks**, a new section on the website (`http://tvbox.local/`). It lists every video already on the box, grouped by where it comes from (`Halloween`, `Halloween / Grownup`, `Thanksgiving`, …), and every upload (photos and videos) under `Uploads`. Each has a tick box.
- Ticking adds the item to the end of the picks and shows its number (1, 2, 3 …); unticking takes it out, and the numbers after it close up. The picks are saved on the box at once, in `~/video-scheduler/picks.json`, so they are still there next time, on any phone.
- **My picks** is also a button next to Kid, Grownup and Black. It plays the picks in the order they were ticked, round and round, for the chosen "For how long" (until the schedule changes, 15/30/60 minutes, until switched back), like every other choice. A single pick loops. Photos show for 10 seconds each, as in All uploads.
- Changing the picks while they play takes effect at once: what is queued behind the item on screen is replaced by the new picks, and an item that was unticked while on screen moves on to the next pick.
- **New uploads join the picks** automatically, at the end. Removing an upload also takes it out of the picks.
- A pick that is no longer on the box (sync moved it away) is skipped and logged once, and drops out of the list.
- With no picks, My picks shows black and logs once that nothing is picked yet.
- The **Photos** button becomes **All uploads**. It still plays every upload, in upload order, as today. Adding photos (PIN, picker, progress) and the list of uploads with Remove stay as they are.
- The name `picks` is kept, like `photos`: a season or a schedule entry called `picks` is ignored and logged, and a folder called `picks` is not offered as a preview.
- The status line reads `picks (override …)`, and the log says when the picks change.

## Capabilities

### New Capabilities
- `my-picks`: choosing items from the box's videos and uploads, keeping them in order on the box, and playing them round and round while My picks is on.

### Modified Capabilities
- `override-website`: the choices and the page offer My picks, and the Photos button becomes All uploads.
- `photo-uploads`: a new upload joins the picks; a removed one leaves them.
- `seasons`: a season named `picks` is ignored and logged.
- `daily-schedule`: a schedule entry for `picks` is ignored and logged.

## Impact

- `scheduler/website.js`: the list of items that can be picked, saving the picks, the My picks button and section, the All uploads label, and uploads joining or leaving the picks.
- `scheduler/logic.js`: the kept name `picks`, a playlist made from the picks file in its own order, and its messages.
- `scheduler/player.js`: rebuilding mpv's queue when the picks change while they play.
- Tests: `website.test.js`, `scheduler.test.js`, `player.test.js`, and a check in the rehearsal's `inside.sh`.
- README ("Using it": My picks) and the window-display-schedule skill.
- On the box: rerun setup (code under `scheduler/` changed). No new packages, no new setup questions.

## Product decisions

From the person:
- The section and its button are called **My picks**.
- Picks play as a **queue in tick order, round and round**; one pick loops.
- My picks works **like the other overrides**, with the usual "For how long" choices and Back to schedule.
- The box **remembers the picks**; new uploads are added to them automatically; **All uploads** still plays every upload like today's Photos button.

## Assumed product decisions

My picks; change any of them.

- **No PIN to pick or play.** Picking only chooses among what is already on the box, like Preview and the Play buttons, which need no PIN. Rejected: asking for the upload PIN.
- **Order is tick order only.** No drag-to-reorder; to move an item to the end, untick and tick it again. Rejected: up/down buttons (can come later).
- **Only videos from the season folders**, never a photo file someone put in a season folder (those never play there either). Uploads offer photos and videos.
- **Each item at most once** in the picks.
- **A pick that disappears** (a video removed from the repo, moved to `.removed/` by sync) is skipped, logged once, and left out of the list; it is gone from the saved picks the next time they are changed. Rejected: showing it greyed out.
- **The wording:**
  - log when the picks change: `My picks: 3 picked (from the website).`;
  - log with no picks: `Nothing picked yet. Showing black until something is ticked in My picks.`;
  - log for a missing pick: `Skipping halloween/old.mp4 in picks: it is no longer on the box.`;
  - the website's answer when saving: `Saved. 3 picked.` (`Saved. Nothing picked.` for none).
