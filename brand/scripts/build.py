"""Builds every Senryo 千両 / Kinpaku 金箔 brand SVG from outlined fonts (no <text> anywhere).

Run through brand/scripts/render.sh (fetches fonts, runs this, rasterises PNGs).
Colours mirror packages/tokens (D2 `gold` #fbfb0f, `background` #000000, KINPAKU foil stops in src/marks.ts).
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
FONTS = os.environ.get("SENRYO_FONT_DIR", os.path.join(BRAND, ".fonts"))
MINCHO = os.path.join(FONTS, "ZenOldMincho-Black.ttf")
MONO = os.path.join(FONTS, "JetBrainsMono-Bold.ttf")

# --- tokens (packages/tokens) -------------------------------------------------
GOLD = "#fbe10f"  # KINPAKU.foilMid — the warm end of the D2 gold family (DARK.gold #fbfb0f reads lemon at icon size)
INK = "#000000"  # DARK.background
PAPER = "#f5f5f5"  # DARK.foreground
LACQUER = "#070707"  # KINPAKU.lacquer
LACQUER_EDGE = "#1a1a1a"  # KINPAKU.lacquerEdge
FOIL = ["#fffbd6", "#fff27a", "#fbe10f", "#c9a800", "#6e5700"]  # KINPAKU highlight → deep


def outline(font: str, text: str, tracking: float = 0) -> dict:
    out = subprocess.run(
        [sys.executable, os.path.join(HERE, "outline.py"), font, text, str(tracking)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(out)


def fit(glyph: dict, box_x: float, box_y: float, box_w: float, box_h: float) -> str:
    """Transform that scales the glyph bbox into the box (uniform) and centres it."""
    x0, y0, x1, y1 = glyph["bbox"]
    s = min(box_w / (x1 - x0), box_h / (y1 - y0))
    tx = box_x + (box_w - (x1 - x0) * s) / 2 - x0 * s
    ty = box_y + (box_h - (y1 - y0) * s) / 2 - y0 * s
    return f"translate({tx:.2f} {ty:.2f}) scale({s:.5f})"


def write(name: str, body: str) -> None:
    with open(os.path.join(BRAND, name), "w") as f:
        f.write(body)
    print("wrote", name)


SEN = outline(MINCHO, "千")
WORD = outline(MONO, "SENRYO", -10)


# --- seal ---------------------------------------------------------------------
def seal_group(size: float, fill: str, carve: str, simple: bool = False, edge: str | None = None) -> str:
    """角印: filled square, carved double border (thick + hairline), carved 千. Coordinates 0..size."""
    k = size / 512
    r = 14 * k
    parts = [f'<rect width="{size}" height="{size}" rx="{r:.2f}" fill="{fill}"/>']
    if edge:
        parts.append(
            f'<rect x="{2 * k:.2f}" y="{2 * k:.2f}" width="{size - 4 * k:.2f}" height="{size - 4 * k:.2f}" '
            f'rx="{r - 2 * k:.2f}" fill="none" stroke="{edge}" stroke-width="{4 * k:.2f}"/>'
        )
    if not simple:
        o = 34 * k
        parts.append(
            f'<rect x="{o:.2f}" y="{o:.2f}" width="{size - 2 * o:.2f}" height="{size - 2 * o:.2f}" rx="{10 * k:.2f}" '
            f'fill="none" stroke="{carve}" stroke-width="{16 * k:.2f}"/>'
        )
        i = 60 * k
        parts.append(
            f'<rect x="{i:.2f}" y="{i:.2f}" width="{size - 2 * i:.2f}" height="{size - 2 * i:.2f}" rx="{4 * k:.2f}" '
            f'fill="none" stroke="{carve}" stroke-width="{4 * k:.2f}"/>'
        )
        box = 90 * k
    else:
        box = 56 * k
    # Optical centre: nudge the glyph up a hair (mincho 千 carries weight in its lower stem).
    t = fit(SEN, box, box - 4 * k, size - 2 * box, size - 2 * box)
    # Embolden with a same-colour stroke (font units): mincho hairlines become carved seal strokes.
    bold = 34 if simple else 22
    parts.append(
        f'<path transform="{t}" fill="{carve}" stroke="{carve}" stroke-width="{bold}" stroke-linejoin="round" '
        f'd="{SEN["d"]}"/>'
    )
    return "\n  ".join(parts)


def svg(w: float, h: float, body: str, title: str, bg: str | None = None, extra_defs: str = "") -> str:
    bg_rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>\n  ' if bg else ""
    defs = f"<defs>{extra_defs}</defs>\n  " if extra_defs else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
        f'role="img" aria-label="{title}">\n  <title>{title}</title>\n  {defs}{bg_rect}{body}\n</svg>\n'
    )


# --- wordmark -----------------------------------------------------------------
def wordmark_group(x: float, y: float, cap: float, fill: str) -> tuple[str, float]:
    """SENRYO outlined, cap height = `cap`, top-left at (x, y). Returns (group, rendered width)."""
    x0, y0, x1, y1 = WORD["bbox"]
    s = cap / (y1 - y0)
    tx = x - x0 * s
    ty = y - y0 * s
    g = f'<path transform="translate({tx:.2f} {ty:.2f}) scale({s:.5f})" fill="{fill}" d="{WORD["d"]}"/>'
    return g, (x1 - x0) * s


def lockup(cap: float, word_fill: str, x: float = 0, y: float = 0) -> tuple[str, float, float]:
    """Seal + wordmark on one line. Seal edge = 1.9 × cap, gap = 0.55 × cap."""
    seal = cap * 1.9
    gap = cap * 0.55
    word, ww = wordmark_group(x + seal + gap, y + (seal - cap) / 2, cap, word_fill)
    g = f'<g transform="translate({x:.2f} {y:.2f})">{seal_group(seal, GOLD, INK)}</g>\n  {word}'
    return g, seal + gap + ww, seal


def build_marks() -> None:
    write("senryo-seal.svg", svg(512, 512, seal_group(512, GOLD, INK), "Senryo 千両 seal"))
    write(
        "senryo-seal-inverse.svg",
        svg(512, 512, seal_group(512, INK, GOLD, edge=GOLD), "Senryo 千両 seal (inverse)"),
    )
    write(
        "senryo-seal-mono.svg",
        svg(512, 512, seal_group(512, "none", PAPER, edge=PAPER), "Senryo 千両 seal (mono)"),
    )
    write("favicon.svg", svg(64, 64, seal_group(64, GOLD, INK, simple=True), "Senryo"))

    cap = 100
    word, ww = wordmark_group(0, 0, cap, PAPER)
    write("senryo-wordmark.svg", svg(round(ww), cap, word, "SENRYO"))
    word_ink, _ = wordmark_group(0, 0, cap, INK)
    write("senryo-wordmark-ink.svg", svg(round(ww), cap, word_ink, "SENRYO"))

    g, w, h = lockup(cap, PAPER)
    write("senryo-lockup.svg", svg(round(w), round(h), g, "Senryo 千両"))
    g_ink, _, _ = lockup(cap, INK)
    write("senryo-lockup-ink.svg", svg(round(w), round(h), g_ink, "Senryo 千両"))

    # App icon: seal at 58% of the canvas, optically centred; black, opaque (iOS rejects alpha).
    s = 1024
    seal = 594
    o = (s - seal) / 2
    write(
        "app-icon.svg",
        svg(s, s, f'<g transform="translate({o} {o})">{seal_group(seal, GOLD, INK)}</g>', "Senryo", bg=INK),
    )

    # Splash: 1290×2796 (iPhone Pro Max), seal 240 + wordmark cap 56 below.
    W, H = 1290, 2796
    seal = 240
    cap = 56
    wm, ww = wordmark_group(0, 0, cap, PAPER)
    top = (H - (seal + 72 + cap)) / 2
    body = (
        f'<g transform="translate({(W - seal) / 2} {top})">{seal_group(seal, GOLD, INK)}</g>\n  '
        f'<g transform="translate({(W - ww) / 2:.2f} {top + seal + 72})">{wm}</g>'
    )
    write("splash.svg", svg(W, H, body, "Senryo", bg=INK))

    # Logo: 2048 wide lockup with generous clear space.
    W = 2048
    cap = 190
    g, w, h = lockup(cap, PAPER)
    H = round(h + 2 * 260)
    body = f'<g transform="translate({(W - w) / 2:.2f} {(H - h) / 2:.2f})">{g}</g>'
    write("logo.svg", svg(W, H, body, "Senryo 千両", bg=INK))
    write("logo-transparent.svg", svg(W, H, body, "Senryo 千両"))


if __name__ == "__main__":
    build_marks()
    from card import build_cards  # noqa: E402  (card art lives in its own module)

    build_cards(outline, fit, svg, seal_group, write, MINCHO, MONO, LACQUER, LACQUER_EDGE, FOIL, INK, GOLD)
