---
name: "window-display-video"
description: "Make a new video for the HalloweenWindowDisplay portrait window TV with the Higgsfield MCP: prompt, generate, finish with ffmpeg, add to a season playlist, update the README."
---

# Window display video

Videos for ndipatri/HalloweenWindowDisplay play on a portrait TV (1080 × 1920) in an upstairs window, seen from the street at night. A Mac runs a scheduler that plays season folders (`playlists/<season>/`, optional `<season>/<playlist>/` subfolders such as `grownup/`) on a schedule; it syncs videos from the repo at login or via `~/video-scheduler/sync`. For changing seasons or the schedule, use the window-display-schedule skill.

## 1. Agree the idea and the cost

- Pin down: subject, mood (kid-friendly vs grownup/scary), season, which playlist (season folder = every period; `grownup/` = grownup only), length.
- Check the balance (`balance`) and quote the cost before generating: Seedance 2.5 at 1080p is **16 credits per second** (20 s = 320, 15 s = 240, 10 s extension = 160). Give it in credits and in USD from how the credits were bought (README "What it cost" has the rates). If credits are short, say so and wait for the person to buy more.

## 2. Write the prompt

Figure videos (the person, creature or pet appears in the window) use this frame:

> Static locked-off camera, vertical frame, pure black background, no environment, no floor, no light sources. The camera is right at a window looking into a dark room. The video begins on an empty, fully black frame. … [subject appears far back in the darkness, comes forward and arrives right at the glass, extremely close to camera, filling the entire height of the frame / face filling most of the frame; does its action; retreats into the darkness and dissolves into the black] … The final seconds are an empty, fully black frame, identical to the opening. [mood], high contrast, [colours] on pure black, no text, no [humans / other animals], no camera movement.

- Starting and ending on black is what makes it loop without a jump. Say both explicitly.
- Say the figure is huge and at the glass; otherwise it comes out small in the middle of the room (the first woman try was discarded for this).
- Kid videos: "playful, funny, kid-friendly". Scary: describe the scare concretely, and add "no blood, no gore, no wounds".
- Scenery videos (e.g. the fall dusk): describe the landscape directly. Do NOT write "as if looking out of a window": the model draws a window frame.
- The README's "The prompts" section has every prompt in use; start from the closest one.

## 3. Generate (Higgsfield MCP)

- `generate_video`, model `seedance_2_5`, aspect ratio 9:16, resolution 1080p, `generate_audio: false`, duration 12–20 s.
- Always pass `declined_preset_id: "24bae836-2c4a-48e0-89b6-49fcc0b21612"` (the "IN THE DARK" preset the person declined).
- A real pet or person: upload the photo (`media_upload`, PUT, `media_confirm`) and use omni-reference mode with it as an image reference. Start the prompt with a precise description: "The dog is the small white fluffy dog from the reference image: curly bright white coat, … Keep his exact look and breed. Ignore the room, couch and poster in the reference." Mochi's photo is media `adbb07ac-e9ee-4faa-9d59-2eceea64b79a`.
- To continue a clip (e.g. dusk into night): video-extension mode, `extension_mode: forward`, with the finished job id as the video reference; prompt "Continue the same shot exactly: the same static locked-off camera, the same …, the same framing." The result is only the new part; join it to the original yourself.
- Wait with `jobs_wait` (timeout ≤ 15 s per call), repeating until done.

## 4. Check it

In `sandbox_exec` (Higgsfield's cloud sandbox has ffmpeg), download the raw result and pull a strip of frames (e.g. 10 timestamps, scaled to 108 px wide, labelled, `hstack`) returned via `image_paths`, and print mean brightness (`signalstats` YAVG) for the first and last second. Confirm: the subject fills the frame, it starts and ends on black, and nothing unwanted was drawn (frames, text). Show the person and iterate. Prefer an ffmpeg edit over a new generation when the fix is framing or timing.

## 5. Finish with ffmpeg (in the Higgsfield sandbox)

The local workspace cannot download from Higgsfield storage, so finishing happens in `sandbox_exec`. Always encode with:

```
-c:v libx264 -preset veryfast -crf 16 -profile:v high -r 24 -pix_fmt yuv420p -movflags +faststart -an
```

Output 1080 × 1920. Optional filters, by video type:

| Video | Filters |
|---|---|
| Full-height figure that should stand at window height (woman, monster) | 20% drop: `crop=iw:ih*0.8:0:0,pad=iw:ih/0.8:0:oh-ih:black`, plus a fade mask on the top edge if the figure fills the frame |
| Scary/eerie (woman, monster) | flicker and glitch flashes: `eq=eval=frame:brightness='-0.05*(0.5+0.5*sin(t*23)*sin(t*7.1+1))-0.45*lt(mod(t*1.3+3*sin(t*0.7),5),0.09)'` |
| Jump scare | no flicker (it would spoil the build-up), no drop |
| Kid / fills the frame (fuzzy creatures, Mochi) | no drop, no flicker |
| Cozy seasonal (Thanksgiving) | no flicker |
| Scenery with a drawn frame | crop 14%: `crop=iw*0.86:ih*0.86:(iw-iw*0.86)/2:(ih-ih*0.86)/2,scale=1080:1920:flags=lanczos` |
| Scenery that doesn't start/end on black | `fade=t=in:st=0:d=1` and a 1.5 s `fade=t=out` at the end |
| Two clips (original + extension) | same filters on both, then `xfade=transition=fade:duration=0.25:offset=<len1-0.25>` |

Keep the script in the sandbox so it can be rerun identically. `video/build_loop.sh` in the repo builds the woman's loop the same way.

## 6. Deliver

1. `media_upload` (filename e.g. `fall_dusk.mp4`), then in the SAME `sandbox_exec` command `curl -X PUT -H "Content-Type: video/mp4" -H "If-None-Match: *" --data-binary @file '<upload_url>'` (expect 200).
2. `media_confirm` (type video), then `show_result` with the media id so the person can watch and download.
3. Ask the person to download it from the card and attach it to the chat.
4. If they attach the raw generation instead, rerun the same ffmpeg locally with identical settings (the output matches byte for byte). A joined video needs both raw clips, so for those ask for the finished version.

## 7. Add it to the repo

- Branch from `origin/main`; copy to `playlists/<season>/` or `playlists/<season>/<playlist>/` with a snake_case name. Under 100 MB (GitHub limit). Files play in name order.
- Update `README.md`:
  - the season's row in "The videos" table (description and m:ss length) and the "Seasons set up today" count;
  - "What it cost": a row per generation, the total, the by-video line, and the credit-pack note;
  - "The prompts": the full prompt, word for word, only for videos that are in `playlists/` (a joined video lists each generation);
  - the notes paragraph under the tables if the finishing differs (drop, flicker, crop, fades);
  - the `playlists/` tree in "Files".
- Commit, push, open a PR with `gh api repos/ndipatri/HalloweenWindowDisplay/pulls -f title=… -f head=<branch> -f base=main -F body=@file` (GraphQL is blocked, so no `gh pr create`). Merge only when asked: `gh api -X PUT repos/ndipatri/HalloweenWindowDisplay/pulls/<n>/merge -f merge_method=merge`.
- Tell the person the Mac picks it up at next login, or now with `~/video-scheduler/sync`, and how to preview it: `show <season> 10` (or `show <season>/<playlist> 10`).
