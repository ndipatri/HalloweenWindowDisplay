#!/bin/bash
# Builds the 4 min 20 s haunted-window loop from the two AI-generated clips.
#
#   bash video/build_loop.sh walk.mp4 hand.mp4 [output.mp4]
#
# walk.mp4  20 s clip: she walks past the window, then away into the dark
# hand.mp4  12 s clip: she comes to the glass and presses her hand on it
#
# Needs ffmpeg (brew install ffmpeg). Output: 1080x1920 H.264, silent,
# starts and ends on black so it loops without a visible seam.
set -euo pipefail

walk="${1:?usage: build_loop.sh walk.mp4 hand.mp4 [output.mp4]}"
hand="${2:?usage: build_loop.sh walk.mp4 hand.mp4 [output.mp4]}"
out="${3:-current.mp4}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

ENC=(-an -c:v libx264 -preset veryfast -crf 16 -pix_fmt yuv420p -r 24)

# Lower the figure by 20% (crop the bottom fifth, pad black on top), because
# the window sill is well above the floor of the room.
SHIFT="scale=1080:1920,crop=iw:ih*0.8:0:0,pad=iw:ih/0.8:0:oh-ih:black,setsar=1"

# Uneven candle-like flicker, plus a rare split-second near-blackout.
FLICKER="eq=eval=frame:brightness='-0.05*(0.5+0.5*sin(t*23)*sin(t*7.1+1))-0.45*lt(mod(t*1.3+3*sin(t*0.7),5),0.09)'"

echo "Preparing clips..."
ffmpeg -v error -y -i "$walk" -vf "$SHIFT,$FLICKER" "${ENC[@]}" "$work/walk.mp4"
ffmpeg -v error -y -i "$walk" -vf "$SHIFT,reverse,$FLICKER" "${ENC[@]}" "$work/reverse.mp4"
ffmpeg -v error -y -i "$hand" -vf "$SHIFT,$FLICKER" "${ENC[@]}" "$work/hand.mp4"

# Glitch: one frame of her suddenly much closer, held for 0.42 s.
ffmpeg -v error -y -ss 9 -i "$walk" -frames:v 1 \
  -vf "$SHIFT,scale=1350:2400,crop=1080:1920:135:300" "$work/glitch.png"
ffmpeg -v error -y -loop 1 -i "$work/glitch.png" -t 0.42 -vf "eq=brightness=-0.03" \
  "${ENC[@]}" "$work/glitch.mp4"

for s in 15 20 25 30 35 40; do
  ffmpeg -v error -y -f lavfi -i "color=black:s=1080x1920:r=24" -t "$s" \
    "${ENC[@]}" "$work/black$s.mp4"
done

# Mostly empty window, with six appearances spread out.
cat > "$work/list.txt" <<EOF
file black25.mp4
file walk.mp4
file black40.mp4
file glitch.mp4
file black30.mp4
file hand.mp4
file black35.mp4
file glitch.mp4
file black20.mp4
file reverse.mp4
file black30.mp4
file hand.mp4
file black15.mp4
EOF

echo "Joining..."
ffmpeg -v error -y -f concat -safe 0 -i "$work/list.txt" "${ENC[@]}" \
  -movflags +faststart "$out"

echo "Done: $out"
ffprobe -v error -show_entries format=duration -of default=nw=1 "$out"
