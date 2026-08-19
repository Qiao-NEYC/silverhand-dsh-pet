"""Generate a labeled contact sheet for the Silverhand sprite atlas.

Pure inspection aid: crops the 8x9 atlas (192x208 cells) into a labeled grid
and writes both a full sheet and a zoomed sheet of the ambiguous rows.
"""
import sys
from PIL import Image, ImageDraw

SPRITE = r"D:\DeepSeekHarness\Silverhand\assets\spritesheet.webp"
OUT_FULL = r"D:\DeepSeekHarness\Silverhand\scripts\contact_full.png"
OUT_ROWS = r"D:\DeepSeekHarness\Silverhand\scripts\contact_rows.png"

ROWS = 9
COLS = 8
CELL_W = 192
CELL_H = 208

ROW_NAMES = ["idle", "running-right", "running-left", "waving", "jumping",
             "failed", "waiting", "running", "review"]


def make_sheet(rows, scale, out_path, with_labels=True):
    im = Image.open(SPRITE).convert("RGBA")
    cw, ch = int(CELL_W * scale), int(CELL_H * scale)
    pad = 6 if with_labels else 0
    label_h = 16 if with_labels else 0
    grid_w = COLS * (cw + pad) + pad
    grid_h = len(rows) * (ch + pad + label_h) + pad
    sheet = Image.new("RGBA", (grid_w, grid_h), (30, 30, 34, 255))
    draw = ImageDraw.Draw(sheet)
    for r_idx, row in enumerate(rows):
        for c in range(COLS):
            x0 = c * CELL_W
            y0 = row * CELL_H
            cell = im.crop((x0, y0, x0 + CELL_W, y0 + CELL_H)).resize((cw, ch), Image.NEAREST)
            px = pad + c * (cw + pad)
            py = pad + r_idx * (ch + pad + label_h)
            sheet.paste(cell, (px, py), cell)
            if with_labels:
                draw.rectangle([px, py + ch, px + cw, py + ch + label_h], fill=(20, 20, 22, 255))
                draw.text((px + 2, py + ch + 1), f"r{row}:c{c}", fill=(255, 255, 255, 255))
    sheet.convert("RGB").save(out_path)
    print("wrote", out_path, sheet.size)


if __name__ == "__main__":
    make_sheet(list(range(ROWS)), 1.0, OUT_FULL)
    # ambiguous rows: waving(3), jumping(4), running(7), review(8)
    make_sheet([3, 4, 7, 8], 2.0, OUT_ROWS)
