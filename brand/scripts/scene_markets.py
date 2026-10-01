"""Scene 3 · Markets. Three lacquer trays, one per kind of market, each carrying two real identities with room
between them: commodities (Senryo's own XAU koban and XAG chōgin), FX (the EUR/USD and JPY/USD pair discs, each with a
plate for its native pair label) and crypto (the Bitcoin and MON marks). Every mark is the registered file, uniformly
scaled, never recoloured. No quotes, no returns, no claim that every market is open in every mode."""
import random

from kit import FIELD, GOLD, INK, PAPER, WHITE, Canvas, contact, embed, field, gloss, n, pts, rot, rrect, shade, soft_ellipse, sprinkle
from props import badge

KEY = "scene-markets"
COLOR = FIELD["yellow"]
SEED = 1303
TRAY_W, TRAY_R, TRAY_WALL, TRAY_THICK = 460, 46, 10, 6
# name, centre, height, tilt (the FX tray is taller: its pair labels sit inside it, under the discs)
TRAYS = (("commodities", (290, 212), 222, -5), ("fx", (462, 486), 282, 4), ("crypto", (294, 770), 222, -4))
PAIR_Y, LABEL_Y = -36, 92  # FX tray coordinates: disc centres and label plate centres
KOBAN_AT, KOBAN_BOX = (-112, 0), 210  # tray coordinates
CHOGIN_AT, CHOGIN_BOX = (96, 4), 228
PAIR_D, PAIRS = 166, (("eurusd", "brand/art/fx-eur-usd.svg", -112, "EUR/USD"), ("jpyusd", "brand/art/fx-jpy-usd.svg", 102, "JPY/USD"))
COINS = (("btc", "packages/identity/sources/bitcoin/bitcoin-disc-core.svg", -108, 184), ("mon", "packages/identity/sources/monad/mon-token-480.svg", 104, 154))
# The FX pair master (art.py): base disc and quote disc as shares of its 256 box (centre x, centre y, radius).
PAIR_DISCS = ((96 / 256, 96 / 256, 86 / 256), (188 / 256, 188 / 256, 62 / 256))
BTC_INSET = 34 / 580  # the Bitcoin Core file's own margin around the disc
LABEL_W, LABEL_H = 146, 48
LABEL_INK = "#17151F"
# Three trays of equal weight: they arrive one after another (a short stagger), the nearest travelling most.
DEPTHS = {"commodities": 0.6, "fx": 0.8, "crypto": 1.0}
MOTION = {"subject": "fx", "mostMotion": ["commodities", "fx", "crypto"]}


def tray(c: Canvas, rng: random.Random, h: float) -> tuple[str, str]:
    """A shallow lacquer tray with a raised lip, origin at its centre."""
    w, r, wall = TRAY_W, TRAY_R, TRAY_WALL
    x, y = -w / 2, -h / 2
    outline = rrect(x, y, w, h, r)
    lip = c.lin([(0, "#463B4F"), (0.35, "#322939"), (1, "#1D1723")], 0, 0, 1, 1)
    well = c.lin([(0, "#1A141F"), (0.5, "#231C29"), (1, "#2C2433")], 0, 0, 1, 1)
    rim = c.lin([(0, WHITE, 0.26), (0.4, WHITE, 0.02), (0.6, INK, 0.05), (1, INK, 0.5)], 0, 0, 1, 1)
    inner = rrect(x + wall, y + wall, w - 2 * wall, h - 2 * wall, r - wall)
    clip = c.clip(f'<path d="{inner}"/>')
    inner_rim = c.lin([(0, INK, 0.75), (0.45, INK, 0.05), (0.6, WHITE, 0.03), (1, WHITE, 0.3)], 0, 0, 1, 1)
    band = pts([(x + w * 0.3, y), (x + w * 0.46, y), (x + w * 0.3, y + h), (x + w * 0.14, y + h)])
    dust = sprinkle(rng, 70, (x, y, x + w, y + h), GOLD["mid"], (0.5, 1.5), lambda px, py: ((px - x) / w) ** 2.4 * 1.2)
    return (
        f'<path d="{rrect(x + TRAY_THICK * 0.6, y + TRAY_THICK, w, h, r)}" fill="#0C0910"/>'
        f'<path d="{outline}" fill="{lip}"/>'
        f'<path d="{inner}" fill="{well}"/>'
        f'<g clip-path="{clip}">'
        f'<path d="{inner}" fill="none" stroke="{INK}" stroke-opacity=".45" stroke-width="14" transform="translate(5 6)"/>'
        f"{dust}{gloss(c, band, 0.04, 0, 0, 0.4, 1)}</g>"
        f'<path d="{inner}" fill="none" stroke="{inner_rim}" stroke-width="1.6"/>'
        f'<path d="{rrect(x + 1, y + 1, w - 2, h - 2, r)}" fill="none" stroke="{rim}" stroke-width="1.6"/>',
        outline,
    )


def resting(c: Canvas, name: str, x: float, y: float, rx: float, ry: float, deg: float = 0.0) -> str:
    """The shadow an object leaves on the tray it rests on: close and dark, in its own group."""
    return f'<g id="{KEY}-{name}-shadow">{soft_ellipse(c, x + 6, y + 9, rx, ry, "#000000", 0.6, deg)}</g>'


def commodities(c: Canvas) -> str:
    return (
        resting(c, "koban", KOBAN_AT[0], KOBAN_AT[1], KOBAN_BOX * 0.3, KOBAN_BOX * 0.44, -12)
        + f'<g id="{KEY}-koban">{embed(c, "brand/art/xau-koban.svg", KOBAN_AT[0] - KOBAN_BOX / 2, KOBAN_AT[1] - KOBAN_BOX / 2, KOBAN_BOX)}</g>'
        + resting(c, "chogin", CHOGIN_AT[0], CHOGIN_AT[1], CHOGIN_BOX * 0.47, CHOGIN_BOX * 0.2, -32)
        + f'<g id="{KEY}-chogin">{embed(c, "brand/art/xag-chogin.svg", CHOGIN_AT[0] - CHOGIN_BOX / 2, CHOGIN_AT[1] - CHOGIN_BOX / 2, CHOGIN_BOX)}</g>'
    )


def fx(c: Canvas) -> str:
    out = []
    for name, path, x, _ in PAIRS:
        y, d = PAIR_Y, PAIR_D
        under = "".join(resting(c, f"{name}-{k}", x - d / 2 + px * d, y - d / 2 + py * d, pr * d * 1.08, pr * d * 1.08) for k, (px, py, pr) in enumerate(PAIR_DISCS))
        out.append(f'{under}<g id="{KEY}-{name}" transform="translate({n(x)} {n(y)})">{badge(c, path, d)}</g>')
    return "".join(out)


def crypto(c: Canvas) -> str:
    out = []
    for name, path, x, d in COINS:
        r = d / 2 * (1 - 2 * BTC_INSET if name == "btc" else 1)
        out.append(f'{resting(c, name, x, 0, r * 1.08, r * 1.08)}<g id="{KEY}-{name}" transform="translate({n(x)} 0)">{badge(c, path, d)}</g>')
    return "".join(out)


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Markets: three lacquer trays for commodities, FX pairs and crypto, with the real marks (Senryo original)")
    rng = random.Random(SEED)
    field(c, COLOR)
    dark = shade(COLOR, 0.8)
    contents = {"commodities": commodities, "fx": fx, "crypto": crypto}
    trays: dict[str, tuple[str, str]] = {}
    for name, (x, y), height, tilt in TRAYS:
        body, outline = tray(c, rng, height)
        t = f"translate({x} {y}) rotate({tilt})"
        trays[name] = (contact(outline, dark, t, 0.5), f'<g transform="{t}">{body}{contents[name](c)}</g>')
    for name, depth in DEPTHS.items():  # every tray shadow lies under every tray
        c.put(f"{name}-shadow", trays[name][0], role="shadow", depth=depth, of=name)
    for name, depth in DEPTHS.items():
        c.put(name, trays[name][1], depth=depth)
    # Plates for the native pair labels (the app draws the text; a pair disc is never shown without its name). They sit
    # in the FX tray's own layer, so they travel with it.
    _, (fx_x, fx_y), _, fx_tilt = TRAYS[1]
    for name, _, x, text in PAIRS:
        lx, ly = rot((x + PAIR_D * 0.06, LABEL_Y), fx_tilt)
        c.put("fx", c.label(name, "fx", text, fx_x + lx - LABEL_W / 2, fx_y + ly - LABEL_H / 2, LABEL_W, LABEL_H, PAPER["light"], LABEL_INK))
    return f"{KEY}.svg", c.svg()
