"""Phone-scale contact sheets for the J1 art review (B12). Review aids only: written to brand/review/ (gitignored).

  python3 brand/scripts/sheets.py     # needs rsvg-convert and ImageMagick 7 (`magick`)

- j1-scenes-{dark,light}.png: the six scenes, each inside a 402 × 874 phone on the app ground with mock copy and the
  fixed controls, so the composition is judged where it will live. Mock chrome is drawn here, never in the masters.
- j1-scene-<n>-{dark,light}@2x.png: one phone at 2x.
- j1-extras.png: pending-passkey art and completion foil on both grounds.
- j1-avatars.png: the twelve avatars as discs at 48 px and 96 px on both grounds.
- brand-card-seal.png: the Kinpaku card face (with a mock of the app's overlay) and back, the seal at header sizes with
  its variants and the app icon, on both grounds.
- seal-sizes.png: the seal at 24, 32, 48 and 88 px on the dark ground and surface, at 1x and 3x, with 8x close-ups.
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


def text_width(font: str, size: int, text: str) -> int:
    out = subprocess.run(["magick", "-font", font, "-pointsize", str(size), f"label:{text}", "-format", "%w", "info:"], check=True, capture_output=True, text=True)
    return int(out.stdout)


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


def brand_marks() -> None:
    """The Kinpaku card face as the Card tab shows it (with a mock of the app's overlay: sample number, holder and
    expiry, a design preview and no issued card), its back, and the seal at header sizes with its variants and the app
    icon, on both grounds."""
    rows = []
    card_w, seal_sizes = 343, (96, 48, 32, 24)  # the card at the Card tab's width; the seal from hero to header size
    for theme, t in THEMES.items():
        s = SCALE
        tiles = []
        for name in ("kinpaku-card", "kinpaku-card-back"):
            png = os.path.join(REVIEW, f".{name}-{theme}.png")
            raster(os.path.join(BRAND, f"{name}.svg"), png, card_w * s)
            tiles.append(png)
        # The app's own overlay (apps/mobile/src/features/card/CardFace.tsx): from 52 % across, between 30 % and 70 %
        # down, 24 pt from the right edge; number on top, holder and expiry side by side at the bottom.
        w, h = card_w * s, round(card_w * s / (85.6 / 54))
        left, right, top, bottom = round(w * 0.52), 24 * s, round(h * 0.3), round(h * 0.7)
        semi, medium = os.path.join(FONTS, "Inter-SemiBold.ttf"), os.path.join(FONTS, "Inter-Medium.ttf")
        # The holder shares its row with the expiry and is cut to one line, as the app does (numberOfLines={1}).
        room = w - left - right - text_width(medium, 16 * s, "08/29") - 8 * s
        holder = "Sample Holder"
        while text_width(medium, 16 * s, holder) > room and len(holder) > 2:
            holder = holder[:-2].rstrip() + "…"
        run(
            "magick", tiles[0],
            "-gravity", "NorthWest", "-font", medium, "-pointsize", str(20 * s), "-fill", "#F5F4FA", "-annotate", f"+{left}+{top}", "•••• 4242",
            "-font", semi, "-pointsize", str(12 * s), "-fill", "#B8B5C4", "-annotate", f"+{left}+{bottom - 38 * s}", "CARD HOLDER",
            "-font", medium, "-pointsize", str(16 * s), "-fill", "#F5F4FA", "-annotate", f"+{left}+{bottom - 20 * s}", holder,
            "-gravity", "NorthEast", "-font", semi, "-pointsize", str(12 * s), "-fill", "#B8B5C4", "-annotate", f"+{right}+{bottom - 38 * s}", "EXPIRES",
            "-font", medium, "-pointsize", str(16 * s), "-fill", "#F5F4FA", "-annotate", f"+{right}+{bottom - 20 * s}", "08/29",
            tiles[0],
        )  # fmt: skip
        for size in seal_sizes:
            png = os.path.join(REVIEW, f".seal-{size}-{theme}.png")
            raster(os.path.join(BRAND, "senryo-seal.svg"), png, size * s)
            tiles.append(png)
        for name in ("senryo-seal-inverse", "senryo-seal-mono" if theme == "dark" else "favicon", "app-icon"):
            png = os.path.join(REVIEW, f".{name}-{theme}.png")
            raster(os.path.join(BRAND, f"{name}.svg"), png, 96 * s)
            tiles.append(png)
        for size in (24, 16):  # under 32 px the seal is drawn with the simplified favicon geometry
            png = os.path.join(REVIEW, f".favicon-{size}-{theme}.png")
            raster(os.path.join(BRAND, "favicon.svg"), png, size * s)
            tiles.append(png)
        row = os.path.join(REVIEW, f".brand-{theme}.png")
        run("magick", *tiles, "-bordercolor", t["ground"], "-border", f"{10 * s}", "-background", t["ground"], "-gravity", "center",
            "+append", "-border", f"{10 * s}", row)  # fmt: skip
        rows.append(row)
    run("magick", *rows, "-gravity", "west", "-background", "#3A3550", "-append", os.path.join(REVIEW, "brand-card-seal.png"))


SEAL_SIZES, SEAL_GROUNDS = (24, 32, 48, 88), ("#0A0911", "#13121A")  # the app's seal sizes; ground and surface


def seal_sizes(seal: str = os.path.join(BRAND, "senryo-seal.svg"), out: str = "seal-sizes.png") -> None:
    """The seal at the app's sizes on the dark ground and surface: each size at 1x (its literal pixels) and at 3x (a
    phone's), then the 24 and 32 px renders blown up 8x without smoothing, so the 千 and the frames can be judged pixel
    by pixel. `seal` is the master to show (another version can be compared), `out` the sheet's name."""
    label = os.path.join(FONTS, "Inter-Medium.ttf")
    rows = []
    for ground in SEAL_GROUNDS:
        tiles = []
        for scale in (1, 3):
            for size in SEAL_SIZES:
                png = os.path.join(REVIEW, f".seal-{size}x{scale}-{ground[1:]}.png")
                raster(seal, png, size * scale)
                run("magick", png, "-background", ground, "-gravity", "center", "-extent", f"{max(size * scale, 64) + 24}x{88 * 3 + 24}",
                    "-gravity", "south", "-font", label, "-pointsize", "13", "-fill", "#B8B5C4", "-splice", "0x22", "-annotate", "+0+4",
                    f"{size} px" + (f" @{scale}x" if scale > 1 else ""), png)  # fmt: skip
                tiles.append(png)
        for size in (24, 32):
            png = os.path.join(REVIEW, f".seal-{size}-zoom-{ground[1:]}.png")
            raster(seal, png, size)
            run("magick", "-size", f"{size}x{size}", f"xc:{ground}", png, "-composite", "-filter", "point", "-resize", "800%",
                "-background", ground, "-gravity", "center", "-extent", f"{size * 8 + 24}x{88 * 3 + 24}",
                "-gravity", "south", "-font", label, "-pointsize", "13", "-fill", "#B8B5C4", "-splice", "0x22", "-annotate", "+0+4",
                f"{size} px, 8x", png)  # fmt: skip
            tiles.append(png)
        row = os.path.join(REVIEW, f".seal-row-{ground[1:]}.png")
        run("magick", *tiles, "-background", ground, "+append", "-bordercolor", ground, "-border", "16", row)
        rows.append(row)
    run("magick", *rows, "-append", "+repage", os.path.join(REVIEW, out))


def main() -> None:
    os.makedirs(REVIEW, exist_ok=True)
    scenes()
    extras()
    avatars()
    brand_marks()
    seal_sizes()
    for name in os.listdir(REVIEW):
        if name.startswith("."):
            os.remove(os.path.join(REVIEW, name))
    print("contact sheets in", os.path.relpath(REVIEW, ROOT))


if __name__ == "__main__":
    main()
