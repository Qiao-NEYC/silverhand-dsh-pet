"""Analyze the Silverhand atlas: report per-row frame diffs and effective length.

For each of the 9 rows, computes the mean absolute pixel delta between
consecutive columns. A near-zero delta means the column repeats the previous
pose (a padded/duplicate frame), so the animation effectively ends earlier.
"""
from PIL import Image
import numpy as np

SPRITE = r"D:\DeepSeekHarness\Silverhand\assets\spritesheet.webp"
ROWS = 9
COLS = 8
CELL_W = 192
CELL_H = 208
ROW_NAMES = ["idle", "running-right", "running-left", "waving", "jumping",
             "failed", "waiting", "running", "review"]

im = np.asarray(Image.open(SPRITE).convert("RGBA"), dtype=np.float32)
print(f"shape={im.shape} (expect 1872 x 1536 x 4)")

for row in range(ROWS):
    frames = []
    for c in range(COLS):
        y0, x0 = row * CELL_H, c * CELL_W
        cell = im[y0:y0 + CELL_H, x0:x0 + CELL_W]
        alpha = cell[:, :, 3]
        opaque = int((alpha > 8).sum())
        frames.append((cell, opaque))
    diffs = []
    for c in range(1, COLS):
        prev = frames[c - 1][0]
        cur = frames[c][0]
        # alpha-weighted RGB delta so transparent padding does not inflate diff
        a = np.maximum(frames[c - 1][0][:, :, 3], frames[c][0][:, :, 3])
        w = a / 255.0
        d = np.abs(prev[:, :, :3] - cur[:, :, :3]).mean(axis=2) * w
        diffs.append(float(d.mean()))
    opaque_counts = [f[1] for f in frames]
    # effective length: last index with a meaningful change vs previous frame
    print(f"row {row} ({ROW_NAMES[row]:13s}) opaque/col={opaque_counts}")
    print(f"    consecutive diffs={[round(d, 2) for d in diffs]}")
