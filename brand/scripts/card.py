"""Kinpaku 金箔 card art (front + back). ISO/IEC 7810 ID-1: 85.6 × 54 mm → viewBox 856 × 540 (0.1 mm units).

The same card as onboarding scene 5 (props.kinpaku_card), drawn flat as an image for the Card tab: lacquer body from
the lacquer ramp, a torn field of thin gold leaf with one sheen direction from the gold-leaf ramp, the seal carved
into the leaf. Names are outlined (no <text>): "Kinpaku" and "Senryo" in Inter Display SemiBold (the app's display
face), 金箔 in Zen Old Mincho Black (the seal's face). No filter, so the SVG draws in react-native-svg and on the web
as it is. The right half of the front stays clear lacquer for the number and holder the app draws over it, and the
bottom right stays empty for the network mark. Deterministic (seeded).
"""
import random

from kit import FOIL, GOLD, INK, LACQUER, WHITE, Canvas, gloss, n, pts, rrect
from props import CARD_CORNER, CARD_RATIO, TEAR_SHADE, crinkles, foil_paint, kinpaku_card, leaf_squares, torn_edge

W = 856
H = W / CARD_RATIO
R = W * CARD_CORNER
MARGIN = 56  # clear edge kept by type and marks
FRONT_TEAR = (0.43, 0.34)  # the leaf stops short of the half the app writes on
FRONT_SEAL, FRONT_SHINE = 0.2, 0.09
NAME_H, KANJI_H, MAKER_H = 30, 22, 21  # outline heights: "Kinpaku", 金箔, "Senryo"
BAND_Y, BAND_H = 66, 58  # the back's leaf band, where a magnetic stripe would sit
BACK_SEED = 2000  # 両
BACK_SEAL = 64
BAND_CRINKLES = 14


def text(glyph: dict, x: float, y: float, height: float, fill: str, align: str = "left", catch: str = "") -> str:
    """An outlined word, `height` tall, its top-left (or top-right) at (x, y). `catch` adds a pressed-in light edge."""
    x0, y0, x1, y1 = glyph["bbox"]
    s = height / (y1 - y0)
    left = x - (x1 - x0) * s if align == "right" else x
    t = f"translate({n(left - x0 * s)} {n(y - y0 * s)}) scale({s:.5f})"
    under = f'<path transform="translate(.8 1.1) {t}" fill="{catch}" fill-opacity=".7" d="{glyph["d"]}"/>' if catch else ""
    return f'{under}<path transform="{t}" fill="{fill}" d="{glyph["d"]}"/>'


def front(names: dict) -> str:
    c = Canvas("kinpaku-card", "Kinpaku 金箔 card", W, H)
    card, _ = kinpaku_card(c, W, tear=FRONT_TEAR, flat=True, seal_size=FRONT_SEAL, shine=FRONT_SHINE)
    c.put(
        "card",
        card,
        text(names["maker"], W * 0.075, H - MARGIN - MAKER_H, MAKER_H, LACQUER["shadow"], catch=GOLD["light"]),
        text(names["name"], W - MARGIN, MARGIN, NAME_H, FOIL[3], "right"),
        text(names["kanji"], W - MARGIN, MARGIN + NAME_H + 14, KANJI_H, FOIL[1], "right"),
    )
    return c.svg()


def back(names: dict, seal_group) -> str:
    """A torn band of leaf where a magnetic stripe would be, the seal in a gold line, quiet type."""
    c = Canvas("kinpaku-card-back", "Kinpaku 金箔 card (back)", W, H)
    rng = random.Random(BACK_SEED)
    outline = rrect(0, 0, W, H, R)
    body = c.lin([(0, "#3A3A3A"), (0.3, LACQUER["mid"]), (1, LACQUER["shadow"])], 0, 0, 1, 1)
    clip = c.clip(f'<path d="{outline}"/>')
    # torn_edge runs top to bottom; the band's edges run left to right, so its points are turned.
    top = [(y, x) for x, y in torn_edge(rng, (BAND_Y, -2), (BAND_Y, W + 2), W * 0.004)]
    bottom = [(y, x) for x, y in torn_edge(rng, (BAND_Y + BAND_H, -2), (BAND_Y + BAND_H, W + 2), W * 0.005)]
    band = pts([*top, *reversed(bottom)])
    band_clip = c.clip(f'<path d="{band}"/>')
    sheen = c.lin([(0, WHITE, 0), (0.5, WHITE, 0.5), (1, WHITE, 0)], 0, 0, 1, 0)
    cell = BAND_H * 1.5
    leaf = (
        f'<g clip-path="{band_clip}"><rect x="-2" y="{n(BAND_Y - 14)}" width="{W + 4}" height="{n(BAND_H + 28)}" fill="{foil_paint(c, 0, 0, 1, 0.35)}"/>'
        f'<g transform="translate(0 {n(BAND_Y - 14)})">{leaf_squares(c, rng, W, BAND_H + 28, cell)}{crinkles(rng, W, BAND_H + 28, BAND_CRINKLES)}</g>'
        f'<path d="{pts([(W * 0.2, 0), (W * 0.36, 0), (W * 0.3, H), (W * 0.14, H)])}" fill="{sheen}" opacity=".5"/></g>'
        f'<path d="{band}" fill="none" stroke="{GOLD["shadow"]}" stroke-opacity=".34" stroke-width="1" stroke-linejoin="round" stroke-dasharray="{TEAR_SHADE}"/>'
    )
    reflection = pts([(W * 0.5, 0), (W * 0.74, 0), (W * 0.4, H), (W * 0.16, H)])
    rim = c.lin([(0, WHITE, 0.55), (0.4, WHITE, 0.04), (0.6, INK, 0.05), (1, INK, 0.5)], 0, 0, 1, 1)
    seal_at = (W - MARGIN - BACK_SEAL, H - MARGIN - BACK_SEAL)
    c.put(
        "card",
        f'<path d="{outline}" fill="{body}"/>'
        f'<g clip-path="{clip}">{leaf}{gloss(c, reflection, FRONT_SHINE, 0, 0, 1, 0.25)}</g>'
        f'<g transform="translate({n(seal_at[0])} {n(seal_at[1])})">{seal_group(BACK_SEAL, "none", GOLD["mid"], edge=GOLD["mid"])}</g>',
        text(names["name"], MARGIN, H - MARGIN - KANJI_H - 12 - NAME_H * 0.8, NAME_H * 0.8, FOIL[3]),
        text(names["kanji"], MARGIN, H - MARGIN - KANJI_H, KANJI_H, FOIL[1]),
        f'<path d="{rrect(0.8, 0.8, W - 1.6, H - 1.6, R)}" fill="none" stroke="{rim}" stroke-width="1.6"/>',
    )
    return c.svg()


def build_cards(outline, seal_group, write, display_font: str, mincho_font: str) -> None:
    names = {"name": outline(display_font, "Kinpaku"), "maker": outline(display_font, "Senryo"), "kanji": outline(mincho_font, "金箔")}
    write("kinpaku-card.svg", front(names))
    write("kinpaku-card-back.svg", back(names, seal_group))
