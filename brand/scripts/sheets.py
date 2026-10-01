"""Phone-scale contact sheets for the J1 art review (B12). Review aids only: written to brand/review/ (gitignored).

  python3 brand/scripts/sheets.py     # needs rsvg-convert and ImageMagick 7 (`magick`)

- j1-scenes-{dark,light}.png: the six scenes, each inside a 402 × 874 phone on the app ground with mock copy and the
  fixed controls, so the composition is judged where it will live. Mock chrome is drawn here, never in the masters.
- j1-scene-<n>-{dark,light}@2x.png: one phone at 2x.
- j1-extras.png: pending-passkey art and completion foil on both grounds.
- j1-avatars.png: the twelve avatars as discs at 48 px and 96 px on both grounds.
"""
import json
import os
import subprocess

from art import BRAND, ROOT

REVIEW = os.path.join(BRAND, "review")
ART = os.path.join(BRAND, "art")
FONTS = os.path.join(ROOT, "apps", "mobile", "assets", "fonts")
PHONE_W, PHONE_H, SCALE = 402, 874, 2
HERO_X, HERO_Y, HERO_W, HERO_H, HERO_R = 12, 58, 378, 470, 32
THEMES = {
    "dark": {"ground": "#0A0911", "text": "#F5F4FA", "text2": "#B8B5C4", "raised": "#201E2B", "link": "#8B95FF"},
    "light": {"ground": "#F5F4F8", "text": "#17151F", "text2": "#5F5B6B", "raised": "#ECE9F2", "link": "#3643D8"},
}
PRIMARY = "#414EF4"
SCENES = (
    ("scene-balance", "One balance. More possibilities.", "See what is available to trade and spend."),
    ("scene-passkey", "Your account, with a passkey.", "Use your device to create and unlock\nyour account."),
    ("scene-markets", "Explore beyond one market.", "Browse commodities, FX and crypto.\nAvailability depends on the market and mode."),
    ("scene-lp", "Explore the liquidity vault.", "Review how liquidity works and the risks\nbefore adding money."),
    ("scene-kinpaku", "Meet Kinpaku.", "Explore the card and its availability."),
    ("scene-modes", "Start with paper money.", "Practice first. Mainnet uses real money."),
)
AVATAR_SIZES = (48, 96)


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def raster(svg: str, png: str, width: int) -> None:
    run("rsvg-convert", "-w", str(width), "-o", png, svg)


def phone(index: int, key: str, title: str, body: str, theme: str) -> str:
    t = THEMES[theme]
    s = SCALE
    hero = os.path.join(REVIEW, f".{key}.png")
    raster(os.path.join(ART, "onboarding", f"{key}.svg"), hero, HERO_W * s)
    out = os.path.join(REVIEW, f"j1-scene-{index + 1}-{theme}@2x.png")
    w, h = HERO_W * s, HERO_H * s
    seg_w, seg_gap, seg_y = 52 * s, 6 * s, (HERO_Y + 16) * s
    seg_x0 = (PHONE_W * s - (6 * seg_w + 5 * seg_gap)) // 2
    segments = []
    for i in range(6):
        x = seg_x0 + i * (seg_w + seg_gap)
        alpha = 0.92 if i <= index else 0.28
        segments += ["-fill", f"rgba(23,18,27,{alpha})", "-draw", f"roundrectangle {x},{seg_y} {x + seg_w},{seg_y + 3 * s} {3 * s},{3 * s}"]
    bx0, bx1 = 20 * s, (PHONE_W - 20) * s
    by1, by2, bh = 690 * s, 752 * s, 52 * s
    with open(os.path.join(ART, "onboarding", "labels.json")) as f:
        anchors = json.load(f)["labels"].get(key, [])
    labels = ["-gravity", "Center", "-font", os.path.join(FONTS, "Inter-SemiBold.ttf")]
    for a in anchors:  # native text over the master's label plates (master units = 2x phone pixels)
        dx = HERO_X * s + a["x"] + a["width"] / 2 - PHONE_W * s / 2
        dy = HERO_Y * s + a["y"] + a["height"] / 2 - PHONE_H * s / 2
        labels += ["-pointsize", str(round(a["height"] * 0.5)), "-fill", a["ink"], "-annotate", f"{dx:+.0f}{dy:+.0f}", a["text"]]
    cmd = [
        "magick", "-size", f"{PHONE_W * s}x{PHONE_H * s}", f"xc:{t['ground']}",
        "(", hero, "(", "-size", f"{w}x{h}", "xc:black", "-fill", "white", "-draw", f"roundrectangle 0,0 {w - 1},{h - 1} {HERO_R * s},{HERO_R * s}", ")",
        "-alpha", "off", "-compose", "CopyOpacity", "-composite", ")",
        "-compose", "Over", "-geometry", f"+{HERO_X * s}+{HERO_Y * s}", "-composite",
        *segments,
        *(labels if anchors else []),
        "-fill", "#000000", "-draw", f"roundrectangle {138 * s},{11 * s} {264 * s},{48 * s} {19 * s},{19 * s}",
        "-gravity", "North", "-font", os.path.join(FONTS, "InterDisplay-SemiBold.ttf"), "-pointsize", str(26 * s), "-fill", t["text"],
        "-annotate", f"+0+{550 * s}", title,
        "-font", os.path.join(FONTS, "Inter-Regular.ttf"), "-pointsize", str(16 * s), "-fill", t["text2"], "-interline-spacing", str(4 * s),
        "-annotate", f"+0+{594 * s}", body,
        "-fill", PRIMARY, "-draw", f"roundrectangle {bx0},{by1} {bx1},{by1 + bh} {26 * s},{26 * s}",
        "-fill", t["raised"], "-draw", f"roundrectangle {bx0},{by2} {bx1},{by2 + bh} {26 * s},{26 * s}",
        "-font", os.path.join(FONTS, "Inter-SemiBold.ttf"), "-pointsize", str(17 * s),
        "-fill", "#FFFFFF", "-annotate", f"+0+{by1 + 15 * s}", "Create account",
        "-fill", t["text"], "-annotate", f"+0+{by2 + 15 * s}", "I already have an account",
        "-fill", t["link"], "-pointsize", str(15 * s), "-annotate", f"+0+{820 * s}", "Browse markets",
        out,
    ]  # fmt: skip
    run(*cmd)
    return out


def grid(files: list[str], per_row: int, out: str, ground: str, pad: int = 0, resize: str = "50%") -> None:
    rows = []
    for r in range(0, len(files), per_row):
        row = os.path.join(REVIEW, f".row{r}.png")
        run("magick", *files[r : r + per_row], "-background", ground, "-splice", f"{pad}x0", "+append", "-resize", resize, row)
        rows.append(row)
    run("magick", *rows, "-background", ground, "-append", out)


def scenes() -> None:
    for theme in THEMES:
        files = [phone(i, key, title, body, theme) for i, (key, title, body) in enumerate(SCENES)]
        grid(files, 3, os.path.join(REVIEW, f"j1-scenes-{theme}.png"), "#3A3550", 24)


def extras() -> None:
    tiles = []
    for name in ("passkey-pending", "completion-foil"):
        png = os.path.join(REVIEW, f".{name}.png")
        raster(os.path.join(ART, "onboarding", f"{name}.svg"), png, 640)
        for theme, t in THEMES.items():
            tile = os.path.join(REVIEW, f".{name}-{theme}.png")
            run("magick", "-size", "640x640", f"xc:{t['ground']}", png, "-composite", tile)
            tiles.append(tile)
    run("magick", *tiles, "+append", os.path.join(REVIEW, "j1-extras.png"))


def avatars() -> None:
    folder = os.path.join(ART, "avatars")
    names = sorted(n for n in os.listdir(folder) if n.endswith(".svg"))
    rows = []
    for theme, t in THEMES.items():
        for size in AVATAR_SIZES:
            discs = []
            for name in names:
                png = os.path.join(REVIEW, f".{name}-{size}.png")
                raster(os.path.join(folder, name), png, size * SCALE)
                d = size * SCALE
                run("magick", png, "(", "-size", f"{d}x{d}", "xc:black", "-fill", "white", "-draw", f"circle {d / 2},{d / 2} {d / 2},0.5", ")",
                    "-alpha", "off", "-compose", "CopyOpacity", "-composite", png)  # fmt: skip
                discs.append(png)
            row = os.path.join(REVIEW, f".avatars-{theme}-{size}.png")
            run("magick", "-background", t["ground"], *discs, "-splice", f"{16 * SCALE}x0", "+append", "-gravity", "center",
                "-extent", f"{(96 + 16) * 12 * SCALE + 32 * SCALE}x{(size + 28) * SCALE}", row)  # fmt: skip
            rows.append(row)
    run("magick", *rows, "-append", os.path.join(REVIEW, "j1-avatars.png"))
    big = [os.path.join(REVIEW, f".big-{name}.png") for name in names]
    for name, png in zip(names, big):
        raster(os.path.join(folder, name), png, 256)
    grid(big, 6, os.path.join(REVIEW, "j1-avatars-256.png"), "#0A0911", 0, "100%")


def main() -> None:
    os.makedirs(REVIEW, exist_ok=True)
    scenes()
    extras()
    avatars()
    for name in os.listdir(REVIEW):
        if name.startswith("."):
            os.remove(os.path.join(REVIEW, name))
    print("contact sheets in", os.path.relpath(REVIEW, ROOT))


if __name__ == "__main__":
    main()
