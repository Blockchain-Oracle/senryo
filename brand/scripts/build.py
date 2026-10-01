"""Builds every Senryo 千両 / Kinpaku 金箔 brand SVG from outlined fonts (no <text> anywhere).

Run through brand/scripts/render.sh (fetches fonts, runs this, rasterises PNGs).
Colours mirror packages/tokens, Living Lacquer (v2 direction §2, §10): the seal keeps its geometry and takes the
gold-leaf ramp (MATERIAL.goldLeaf in src/marks.ts), carved in lacquer; grounds and type come from src/palette.ts.
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
DISPLAY = os.path.join(os.path.dirname(BRAND), "apps", "mobile", "assets", "fonts", "InterDisplay-SemiBold.ttf")

# --- tokens (packages/tokens) -------------------------------------------------
# MATERIAL.goldLeaf (shadow, mid, highlight) with the KINPAKU foil intermediates (foilShade, foilLight).
LEAF = {"shadow": "#886426", "shade": "#AE8941", "mid": "#D4AE5B", "light": "#EACF8C", "highlight": "#FFF0BC"}
LACQUER = {"shadow": "#17121B", "mid": "#29212F"}  # MATERIAL.lacquer
CARVE = LACQUER["shadow"]  # what the seal is carved in, and the inverse seal's field
GROUND = "#0A0911"  # DARK.background — app icon, splash, logo
PAPER = "#F5F4FA"  # DARK.foreground — wordmark and mono seal on dark grounds
INK = "#17151F"  # LIGHT.foreground — wordmark on light grounds


def gradient(gid: str, stops: list[tuple], attrs: str = 'x1="0" y1="0" x2="1" y2="1"') -> str:
    """A linearGradient; each stop is (offset, colour) or (offset, colour, opacity)."""
    body = "".join(
        f'<stop offset="{s[0]:g}" stop-color="{s[1]}"' + (f' stop-opacity="{s[2]:g}"' if len(s) > 2 else "") + "/>" for s in stops
    )
    return f'<linearGradient id="{gid}" {attrs}>{body}</linearGradient>'


# The gold-leaf seal, lit from the upper left (the onboarding scenes' lamp): the field runs the whole ramp corner to
# corner, the lamp's reflection is a soft round bloom of the highlight off the lit corner (so the light falls off in
# two directions, not in one straight band), and the bevel is light along the lit edges and shade along the far ones,
# fading out between.
LEAF_FILL, LEAF_SHEEN, LEAF_BEVEL = "url(#senryo-leaf)", "url(#senryo-leaf-sheen)", "url(#senryo-leaf-bevel)"
LEAF_DEFS = (
    gradient("senryo-leaf", [(0, LEAF["light"]), (0.3, LEAF["mid"]), (0.7, LEAF["shade"]), (1, LEAF["shadow"])])
    + f'<radialGradient id="senryo-leaf-sheen" cx=".26" cy=".22" r=".62"><stop offset="0" stop-color="{LEAF["highlight"]}" '
    f'stop-opacity=".4"/><stop offset=".5" stop-color="{LEAF["highlight"]}" stop-opacity=".13"/>'
    f'<stop offset="1" stop-color="{LEAF["highlight"]}" stop-opacity="0"/></radialGradient>'
    + gradient("senryo-leaf-bevel", [(0, LEAF["highlight"], 0.85), (0.4, LEAF["highlight"], 0), (0.6, LEAF["shadow"], 0), (1, LEAF["shadow"], 0.85)])
)
CATCH_SHIFT, CATCH_OPACITY = (2.0, 2.6), 0.5  # the light a carved edge catches: offset in seal units (of 512), strength
BEVEL_WIDTH = 5  # seal units (of 512)
# The inverse seal: lacquer lit the same way, the carving filled with gold leaf (one ramp across the whole seal).
INVERSE_FILL, INVERSE_CARVE = "url(#senryo-lacquer)", "url(#senryo-leaf-inlay)"
INVERSE_DEFS = gradient("senryo-lacquer", [(0, LACQUER["mid"]), (0.55, LACQUER["shadow"])]) + gradient(
    "senryo-leaf-inlay",
    [(0, LEAF["highlight"]), (0.25, LEAF["light"]), (0.55, LEAF["mid"]), (1, LEAF["shade"])],
    'x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"',
)


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
def seal_group(size: float, fill: str, carve: str, simple: bool = False, edge: str | None = None, leaf: bool = False) -> str:
    """角印: filled square, carved double border (thick + hairline), carved 千. Coordinates 0..size.
    `leaf` is the gold-leaf seal: a sheen and a bevel on the field and a line of light caught under every carved edge."""
    k = size / 512
    r = 14 * k
    parts = [f'<rect width="{size}" height="{size}" rx="{r:.2f}" fill="{fill}"/>']
    if leaf:
        b = BEVEL_WIDTH * k
        parts.append(f'<rect width="{size}" height="{size}" rx="{r:.2f}" fill="{LEAF_SHEEN}"/>')
        parts.append(
            f'<rect x="{b / 2:.2f}" y="{b / 2:.2f}" width="{size - b:.2f}" height="{size - b:.2f}" rx="{r - b / 2:.2f}" '
            f'fill="none" stroke="{LEAF_BEVEL}" stroke-width="{b:.2f}"/>'
        )
    if edge:
        parts.append(
            f'<rect x="{2 * k:.2f}" y="{2 * k:.2f}" width="{size - 4 * k:.2f}" height="{size - 4 * k:.2f}" '
            f'rx="{r - 2 * k:.2f}" fill="none" stroke="{edge}" stroke-width="{4 * k:.2f}"/>'
        )
    carved = []
    if not simple:
        o = 34 * k
        carved.append(
            f'<rect x="{o:.2f}" y="{o:.2f}" width="{size - 2 * o:.2f}" height="{size - 2 * o:.2f}" rx="{10 * k:.2f}" '
            f'fill="none" stroke="INK" stroke-width="{16 * k:.2f}"/>'
        )
        i = 60 * k
        carved.append(
            f'<rect x="{i:.2f}" y="{i:.2f}" width="{size - 2 * i:.2f}" height="{size - 2 * i:.2f}" rx="{4 * k:.2f}" '
            f'fill="none" stroke="INK" stroke-width="{4 * k:.2f}"/>'
        )
        box = 90 * k
    else:
        box = 56 * k
    # Optical centre: nudge the glyph up a hair (mincho 千 carries weight in its lower stem).
    t = fit(SEN, box, box - 4 * k, size - 2 * box, size - 2 * box)
    # Embolden with a same-colour stroke (font units): mincho hairlines become carved seal strokes.
    bold = 34 if simple else 22
    carved.append(
        f'<path transform="{t}" fill="INK" stroke="INK" stroke-width="{bold}" stroke-linejoin="round" d="{SEN["d"]}"/>'
    )
    carving = "\n  ".join(carved)  # drawn once per ink: "INK" stands for the colour
    if leaf:
        dx, dy = CATCH_SHIFT[0] * k, CATCH_SHIFT[1] * k
        caught = carving.replace("INK", LEAF["highlight"])
        parts.append(f'<g transform="translate({dx:.2f} {dy:.2f})" opacity="{CATCH_OPACITY}">{caught}</g>')
    parts.append(carving.replace("INK", carve))
    return "\n  ".join(parts)


def leaf_seal(size: float, simple: bool = False) -> str:
    """The primary seal: gold-leaf field, lacquer carving (needs LEAF_DEFS in the file's defs)."""
    return seal_group(size, LEAF_FILL, CARVE, simple=simple, leaf=True)


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
    g = f'<g transform="translate({x:.2f} {y:.2f})">{leaf_seal(seal)}</g>\n  {word}'
    return g, seal + gap + ww, seal


def build_marks() -> None:
    write("senryo-seal.svg", svg(512, 512, leaf_seal(512), "Senryo 千両 seal", extra_defs=LEAF_DEFS))
    write(
        "senryo-seal-inverse.svg",
        svg(
            512,
            512,
            seal_group(512, INVERSE_FILL, INVERSE_CARVE, edge=INVERSE_CARVE),
            "Senryo 千両 seal (inverse)",
            extra_defs=INVERSE_DEFS,
        ),
    )
    write(
        "senryo-seal-mono.svg",
        svg(512, 512, seal_group(512, "none", PAPER, edge=PAPER), "Senryo 千両 seal (mono)"),
    )
    write("favicon.svg", svg(64, 64, leaf_seal(64, simple=True), "Senryo", extra_defs=LEAF_DEFS))

    cap = 100
    word, ww = wordmark_group(0, 0, cap, PAPER)
    write("senryo-wordmark.svg", svg(round(ww), cap, word, "SENRYO"))
    word_ink, _ = wordmark_group(0, 0, cap, INK)
    write("senryo-wordmark-ink.svg", svg(round(ww), cap, word_ink, "SENRYO"))

    g, w, h = lockup(cap, PAPER)
    write("senryo-lockup.svg", svg(round(w), round(h), g, "Senryo 千両", extra_defs=LEAF_DEFS))
    g_ink, _, _ = lockup(cap, INK)
    write("senryo-lockup-ink.svg", svg(round(w), round(h), g_ink, "Senryo 千両", extra_defs=LEAF_DEFS))

    # App icon: seal at 58% of the canvas, optically centred; on the app ground, opaque (iOS rejects alpha).
    s = 1024
    seal = 594
    o = (s - seal) / 2
    write(
        "app-icon.svg",
        svg(s, s, f'<g transform="translate({o} {o})">{leaf_seal(seal)}</g>', "Senryo", bg=GROUND, extra_defs=LEAF_DEFS),
    )

    # Splash: 1290×2796 (iPhone Pro Max), seal 240 + wordmark cap 56 below.
    W, H = 1290, 2796
    seal = 240
    cap = 56
    wm, ww = wordmark_group(0, 0, cap, PAPER)
    top = (H - (seal + 72 + cap)) / 2
    body = (
        f'<g transform="translate({(W - seal) / 2} {top})">{leaf_seal(seal)}</g>\n  '
        f'<g transform="translate({(W - ww) / 2:.2f} {top + seal + 72})">{wm}</g>'
    )
    write("splash.svg", svg(W, H, body, "Senryo", bg=GROUND, extra_defs=LEAF_DEFS))

    # Logo: 2048 wide lockup with generous clear space.
    W = 2048
    cap = 190
    g, w, h = lockup(cap, PAPER)
    H = round(h + 2 * 260)
    body = f'<g transform="translate({(W - w) / 2:.2f} {(H - h) / 2:.2f})">{g}</g>'
    write("logo.svg", svg(W, H, body, "Senryo 千両", bg=GROUND, extra_defs=LEAF_DEFS))
    write("logo-transparent.svg", svg(W, H, body, "Senryo 千両", extra_defs=LEAF_DEFS))


if __name__ == "__main__":
    build_marks()
    from card import build_cards  # noqa: E402  (card art lives in its own module; it reads the seal written above)

    build_cards(outline, seal_group, write, DISPLAY, MINCHO)
