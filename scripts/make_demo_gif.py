# Generates docs/demo.gif — an animated demo cycling through every pet
# animation in the atlas (with state labels).
#
# Usage:  python scripts/make_demo_gif.py
from PIL import Image, ImageDraw, ImageFont

SPRITE = r"D:\DeepSeekHarness\Silverhand\assets\spritesheet.webp"
OUT = r"D:\DeepSeekHarness\Silverhand\docs\demo.gif"

COLS = 8
CELL_W = 192
CELL_H = 208
SCALE = 2
BG = (232, 234, 237)  # light neutral card background

# (label, row, [columns], ms per frame)
SEQUENCE = [
    ("idle", 0, [0, 1, 2, 3, 4, 5], 220),
    ("waving", 3, [0, 1, 2, 3, 4, 5, 6, 7], 160),
    ("walk right", 1, [0, 1, 2, 3, 4, 5, 6, 7], 120),
    ("walk left", 2, [0, 1, 2, 3, 4, 5, 6, 7], 120),
    ("jumping", 4, [0, 1, 2, 3, 4, 5, 6, 7], 140),
    ("working", 7, [0, 1, 2, 3, 4, 5, 6, 7], 120),
    ("reviewing", 8, [0, 1, 2, 3, 4, 5, 6, 7], 160),
    ("failed", 5, [0, 1, 2, 3, 4, 5, 6, 7], 160),
    ("waiting", 6, [0, 1, 2, 3, 4, 5], 180),
]


def load_font(size):
    for path in (
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    im = Image.open(SPRITE).convert("RGBA")
    font = load_font(16)

    frames = []
    durations = []
    for label, row, cols, ms in SEQUENCE:
        for col in cols:
            cell = im.crop((col * CELL_W, row * CELL_H, (col + 1) * CELL_W, (row + 1) * CELL_H))
            cell = cell.resize((CELL_W * SCALE, CELL_H * SCALE), Image.NEAREST)

            label_h = 36
            canvas = Image.new("RGB", (CELL_W * SCALE, CELL_H * SCALE + label_h), BG)
            canvas.paste(cell, (0, 0), cell)

            d = ImageDraw.Draw(canvas)
            # label pill
            tw = d.textlength(label, font=font)
            pad = 12
            cx = canvas.width // 2
            y0 = CELL_H * SCALE + 6
            d.rounded_rectangle(
                [cx - tw / 2 - pad, y0, cx + tw / 2 + pad, y0 + 22],
                radius=11,
                fill=(24, 26, 32),
            )
            d.text((cx - tw / 2, y0 + 3), label, font=font, fill=(255, 255, 255))

            frames.append(canvas)
            durations.append(ms)

    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
    )
    print(f"wrote {OUT}: {len(frames)} frames, {canvas.width}x{canvas.height}, {sum(durations)/1000:.1f}s")


if __name__ == "__main__":
    main()
