#!/usr/bin/env python3
"""Build playlists/thanksgiving/steady_fall_sun.mp4 from fall_dusk.mp4.

The calm version of the fall sunset: the sun stays put, the light never
changes, the leaves keep falling.

How: fall_dusk.mp4 has a nearly steady stretch from 1.0 s to 7.0 s (after
its fade-in, before the sun starts to sink). This script
  1. takes those 6 s,
  2. matches every frame's brightness and colour to the 1.0 s frame, so the
     light is constant,
  3. pins the sun disc to the 1.0 s frame (it drifts ~9 px otherwise),
  4. crossfades the last 1.5 s into the first 1.5 s, giving a 4.5 s piece
     that loops onto itself with no jump,
  5. repeats it to 22.5 s, fades in 1 s from black and out 1.5 s to black
     (like every other video), and encodes it for the portrait TV.

Usage: python3 build_steady_sun.py <ffmpeg> <fall_dusk.mp4> <out.mp4> [--preview DIR]
Needs numpy.
"""
import subprocess
import sys

import numpy as np

W, H, FPS = 1080, 1920, 24
START, LENGTH = 1.0, 6.0          # steady stretch of the original
XFADE = 36                        # 1.5 s crossfade, in frames
REPEATS = 5                       # 5 x 4.5 s = 22.5 s
FADE_IN, FADE_OUT = 24, 36        # 1 s in, 1.5 s out
SUN_X, SUN_Y = 459, 1005          # sun centre in the 1.0 s frame
SUN_R, SUN_FEATHER = 70, 50       # pinned disc radius and soft edge, px

ENCODE = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-profile:v', 'high',
          '-r', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an']


def read_frames(ffmpeg, src):
    raw = subprocess.run(
        [ffmpeg, '-v', 'error', '-ss', str(START), '-i', src, '-t', str(LENGTH),
         '-vf', 'scale=in_color_matrix=bt709:in_range=tv',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)


def main():
    ffmpeg, src, out = sys.argv[1:4]
    frames = read_frames(ffmpeg, src).astype(np.float32)
    n = len(frames)
    ref = frames[0]

    # 2. constant light: per-channel gain to the reference frame's mean colour
    ref_mean = ref.reshape(-1, 3).mean(0)
    for i in range(n):
        frames[i] *= ref_mean / frames[i].reshape(-1, 3).mean(0)

    # 3. pinned sun: feathered disc copied from the reference frame
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.hypot(xx - SUN_X, yy - SUN_Y)
    mask = np.clip((SUN_R + SUN_FEATHER - dist) / SUN_FEATHER, 0, 1)[..., None].astype(np.float32)
    y0, y1 = SUN_Y - SUN_R - SUN_FEATHER, SUN_Y + SUN_R + SUN_FEATHER
    x0, x1 = SUN_X - SUN_R - SUN_FEATHER, SUN_X + SUN_R + SUN_FEATHER
    m = mask[y0:y1, x0:x1]
    for i in range(n):
        frames[i, y0:y1, x0:x1] = frames[i, y0:y1, x0:x1] * (1 - m) + ref[y0:y1, x0:x1] * m

    # 4. loop piece: first XFADE frames blend the tail into the head
    unit = []
    for k in range(n - XFADE):
        if k < XFADE:
            a = (k + 0.5) / XFADE
            unit.append(frames[n - XFADE + k] * (1 - a) + frames[k] * a)
        else:
            unit.append(frames[k])
    unit = [np.clip(f, 0, 255).astype(np.uint8) for f in unit]

    if '--preview' in sys.argv:  # seam check: last 3 + first 3 frames of the piece
        d = sys.argv[sys.argv.index('--preview') + 1]
        np.save(f'{d}/seam.npy', np.stack(unit[-3:] + unit[:3])[:, ::4, ::4])

    # 5. repeat, fade, encode
    total = len(unit) * REPEATS
    enc = subprocess.Popen(
        [ffmpeg, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
         '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
         '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
         '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'] + ENCODE + [out],
        stdin=subprocess.PIPE)
    for t in range(total):
        f = unit[t % len(unit)]
        g = min(1.0, (t + 1) / FADE_IN, (total - t) / FADE_OUT)
        if g < 1.0:
            f = (f.astype(np.float32) * g).astype(np.uint8)
        enc.stdin.write(f.tobytes())
    enc.stdin.close()
    sys.exit(enc.wait())


if __name__ == '__main__':
    main()
