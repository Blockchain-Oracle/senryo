"""Reusable authored objects for the J1 scenes: the Kinpaku card, the lacquer dish that carries a koban, real-mark
badges. Every function returns markup in local coordinates (the caller places it) plus the outline its shadow needs."""
import math
import random

from kit import FOIL, GOLD, INK, LACQUER, WHITE, Canvas, carved_seal, embed, flake, mix, n, pts, ramp, rrect

CARD_RATIO = 85.6 / 54  # ISO/IEC 7810 ID-1
CARD_CORNER = 3.18 / 85.6  # corner radius as a share of the width
CARD_SEED = 1000
LEAF_ROWS = 3.4  # gold-leaf squares across the card's height
CRINKLES = 26
TORN_STEPS = 120
CRUMBS = 9  # leaf fragments that came away along the torn edge
TEAR_SHADE = "23 9 41 14 7 19 58 11"  # the tear's faint shade comes and goes: leaf has no edge to outline


def torn_edge(rng: random.Random, top, bottom, jitter: float, steps=TORN_STEPS) -> list[tuple[float, float]]:
    """A hand-torn leaf edge between two points: leaf this thin tears in a fine, feathered line. Unevenly spaced
    points, a slow wander, a fine tremor between them, and rarely one small bite. Nothing about it repeats."""
    cuts = sorted(rng.random() for _ in range(steps - 1))
    drift, out = 0.0, []
    for t in (0.0, *cuts, 1.0):
        drift = drift * 0.9 + rng.uniform(-1, 1) * jitter * 0.45
        bite = jitter * rng.uniform(0.8, 1.6) if rng.random() < 0.03 else 0
        out.append((top[0] + (bottom[0] - top[0]) * t + drift + rng.uniform(-0.35, 0.35) * jitter + bite, top[1] + (bottom[1] - top[1]) * t))
    return out


def leaf_squares(c: Canvas, rng: random.Random, w: float, h: float, cell: float) -> str:
    """Kinpaku is laid in squares a ten-thousandth of a millimetre thick: no edge, no bevel. Each sheet only takes the
    light a touch differently, and where two sheets overlap the gold is a shade denser along a faint, wavering seam."""
    out = []
    rows = int(h / cell) + 2
    cols = int(w / cell) + 2
    for row in range(rows):
        for col in range(cols):
            x = (col - 0.5) * cell + rng.uniform(-4, 4) + (cell * 0.35 if row % 2 else 0)
            y = (row - 0.4) * cell + rng.uniform(-4, 4)
            tone, alpha = (WHITE, rng.uniform(0.0, 0.07)) if rng.random() < 0.5 else (GOLD["shadow"], rng.uniform(0.0, 0.09))
            a = rng.uniform(-2.5, 2.5)
            lap = cell * rng.uniform(0.02, 0.05)
            wob = cell * 0.012
            seam = (
                f"M{n(x)} {n(y + cell)}Q{n(x + rng.uniform(-wob, wob))} {n(y + cell / 2)} {n(x)} {n(y)}"
                f"Q{n(x + cell / 2)} {n(y + rng.uniform(-wob, wob))} {n(x + cell)} {n(y)}"
            )
            out.append(
                f'<g transform="rotate({n(a)} {n(x + cell / 2)} {n(y + cell / 2)})">'
                f'<rect x="{n(x)}" y="{n(y)}" width="{n(cell)}" height="{n(cell)}" fill="{tone}" fill-opacity="{n(alpha)}"/>'
                f'<rect x="{n(x)}" y="{n(y)}" width="{n(lap)}" height="{n(cell)}" fill="{GOLD["shadow"]}" fill-opacity="{n(rng.uniform(0.03, 0.1))}"/>'
                f'<rect x="{n(x)}" y="{n(y)}" width="{n(cell)}" height="{n(lap)}" fill="{GOLD["shadow"]}" fill-opacity="{n(rng.uniform(0.03, 0.1))}"/>'
                f'<path d="{seam}" fill="none" stroke="{GOLD["shadow"]}" stroke-opacity="{n(rng.choice((0.06, 0.1, 0.16, 0.22)))}" stroke-width="{n(max(cell * 0.006, 0.6))}"/></g>'
            )
    return "".join(out)


def crinkles(rng: random.Random, w: float, h: float, count: int) -> str:
    """The fine creases beaten leaf keeps: short hairlines, half catching light, half in shade."""
    light, dark = [], []
    for _ in range(count):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        length, a = rng.uniform(w * 0.02, w * 0.07), rng.uniform(0.3, 1.3)
        seg = f"M{n(x)} {n(y)}q{n(length * 0.5 * math.cos(a) + rng.uniform(-2, 2))} {n(length * 0.5 * math.sin(a))} {n(length * math.cos(a))} {n(length * math.sin(a))}"
        (light if rng.random() < 0.5 else dark).append(seg)
    return (
        f'<path d="{"".join(light)}" fill="none" stroke="{WHITE}" stroke-opacity=".2" stroke-width=".8" stroke-linecap="round"/>'
        f'<path d="{"".join(dark)}" fill="none" stroke="{GOLD["shadow"]}" stroke-opacity=".2" stroke-width=".8" stroke-linecap="round"/>'
    )


def foil_paint(c: Canvas, x1=0.0, y1=0.0, x2=1.0, y2=1.0) -> str:
    """Directional gold foil: the leaf ramp run as bands, so the sheen has one clear direction."""
    return c.lin(
        [(0, FOIL[0]), (0.16, FOIL[1]), (0.34, FOIL[2]), (0.5, FOIL[4]), (0.6, FOIL[3]), (0.78, FOIL[2]), (1, FOIL[1])],
        x1, y1, x2, y2,
    )  # fmt: skip


CARD_TEAR = (0.56, 0.4)  # where the leaf's torn edge meets the top and the bottom of the card (share of its width)
CARD_SEAL, CARD_GLOSS = 0.23, 0.16  # the seal's edge as a share of the card's height; strength of the lacquer reflection


def kinpaku_card(
    c: Canvas, w: float, seed: int = CARD_SEED, tear=CARD_TEAR, flat: bool = False, seal_size: float = CARD_SEAL, shine: float = CARD_GLOSS
) -> tuple[str, str]:
    """The Kinpaku card face up: lacquer body, a torn field of gold leaf with one sheen direction, the carved seal.
    Returns (markup, outline path) in local coordinates, origin at the card's top-left corner. `flat` leaves out the
    card's thickness (the card face used as an image, not as an object in a scene)."""
    rng = random.Random(seed)
    h = w / CARD_RATIO
    r = w * CARD_CORNER
    t = max(w * 0.011, 2.5)  # thickness
    outline = rrect(0, 0, w, h, r)
    body = c.lin([(0, "#3A3A3A"), (0.3, LACQUER["mid"]), (1, LACQUER["shadow"])], 0, 0, 1, 1)
    clip = c.clip(f'<path d="{outline}"/>')
    edge = "" if flat else "".join(
        f'<path d="{rrect(i * 0.8, i, w, h, r)}" fill="{mix_edge(i / t)}"/>' for i in (t, t * 0.66, t * 0.33)
    )
    # The leaf: left part of the card, torn along a slanted edge.
    torn = torn_edge(rng, (w * tear[0], -2), (w * tear[1], h + 2), w * 0.008)
    leaf = pts([(-2, -2), *torn, (-2, h + 2)])
    leaf_clip = c.clip(f'<path d="{leaf}"/>')
    cell = h / LEAF_ROWS
    crumbs = []
    for _ in range(CRUMBS):
        ty = rng.uniform(0, h)
        tx = w * (tear[0] + (tear[1] - tear[0]) * (ty / h))
        reach = abs(rng.gauss(0, 0.028)) * w
        size = max(w * 0.006 * (1 - reach / (w * 0.3)), w * 0.0022)
        crumbs.append((tx + w * 0.012 + reach, ty, size))
    crumb_paint = c.lin([(0, FOIL[4]), (0.5, FOIL[2]), (1, FOIL[0])], 0, 0, 1, 1)
    crumb_d = "".join(flake(rng, x, y, s) for x, y, s in crumbs)
    seal = h * seal_size
    sx, sy = w * 0.075, h * 0.13
    carve = LACQUER["shadow"]
    seal_markup = carved_seal(sx, sy, seal, carve, GOLD["light"])  # the seal's own geometry, carved into the leaf
    band = pts([(w * 0.5, 0), (w * 0.74, 0), (w * 0.4, h), (w * 0.16, h)])
    band_paint = c.lin([(0, WHITE, 0), (0.5, WHITE, shine), (1, WHITE, 0)], 0, 0, 1, 0.25)
    thin = pts([(w * 0.8, 0), (w * 0.86, 0), (w * 0.52, h), (w * 0.46, h)])
    rim = c.lin([(0, WHITE, 0.55), (0.4, WHITE, 0.04), (0.6, INK, 0.05), (1, INK, 0.5)], 0, 0, 1, 1)
    sheen = c.lin([(0, WHITE, 0), (0.5, WHITE, 0.55), (1, WHITE, 0)], 0, 0, 1, 0.3)
    markup = (
        f"{edge}"
        f'<path d="{outline}" fill="{body}"/>'
        f'<g clip-path="{clip}">'
        f'<g clip-path="{leaf_clip}"><rect x="-2" y="-2" width="{n(w * 0.6)}" height="{n(h + 4)}" fill="{foil_paint(c, 0, 0, 1, 0.9)}"/>'
        f"{leaf_squares(c, rng, w * 0.6, h, cell)}{crinkles(rng, w * 0.56, h, CRINKLES)}"
        f'<g id="{c.key}-card-sheen"><path d="{pts([(w * 0.17, 0), (w * 0.33, 0), (w * 0.09, h), (-w * 0.07, h)])}" fill="{sheen}" opacity=".6"/></g>'
        f"{seal_markup}</g>"
        f'<path d="M{"L".join(f"{n(x)} {n(y)}" for x, y in torn)}" fill="none" stroke="{GOLD["shadow"]}" stroke-opacity=".34" '
        f'stroke-width="{n(max(w * 0.0016, 0.8))}" stroke-linejoin="round" stroke-dasharray="{TEAR_SHADE}"/>'
        f'<path d="{crumb_d}" fill="{crumb_paint}"/>'
        f'<path d="{band}" fill="{band_paint}"/>{"" if flat else f'<path d="{thin}" fill="{band_paint}" opacity=".6"/>'}</g>'
        f'<path d="{rrect(0.8, 0.8, w - 1.6, h - 1.6, r)}" fill="none" stroke="{rim}" stroke-width="1.6"/>'
    )
    return markup, outline


def mix_edge(t: float) -> str:
    """Card and dish edges: lacquer shadow at the far side, a touch lighter where it meets the face."""
    return ramp(("#1D1D1D", "#0B0B0B"), t)


def dish(c: Canvas, r: float, rim: tuple[str, str, str], thick: float = 0.0) -> str:
    """A round lacquer dish centred on (0, 0): edge thickness to the lower right, urushi face, one metal rim line."""
    thick = thick or r * 0.07
    face = c.rad([(0, LACQUER["light"]), (0.5, LACQUER["mid"]), (1, LACQUER["shadow"])], 0.32, 0.26, 0.95)
    lip = c.lin([(0, WHITE, 0.5), (0.45, WHITE, 0.03), (1, INK, 0.5)], 0, 0, 1, 1)
    ring = c.lin([(0, rim[2], 0.95), (0.5, rim[1], 0.7), (1, rim[0], 0.85)], 0, 0, 1, 1)
    edge = "".join(
        f'<circle cx="{n(thick * 0.6 * k)}" cy="{n(thick * k)}" r="{n(r)}" fill="{mix_edge(k)}"/>' for k in (1, 0.66, 0.33)
    )
    return (
        f"{edge}"
        f'<circle r="{n(r)}" fill="{face}"/>'
        f'<circle r="{n(r - 1.2)}" fill="none" stroke="{lip}" stroke-width="2.4"/>'
        f'<circle r="{n(r * 0.9)}" fill="none" stroke="{ring}" stroke-width="{n(max(r * 0.016, 1.6))}"/>'
    )


def koban_dish(c: Canvas, r: float, rim=None) -> str:
    """The XAU koban (the registered master, untouched) resting on a lacquer dish."""
    rim = rim or (GOLD["shadow"], GOLD["mid"], GOLD["light"])
    size = r * 1.62
    return dish(c, r, rim) + embed(c, "brand/art/xau-koban.svg", -size / 2, -size / 2, size)


def badge(c: Canvas, path: str, d: float) -> str:
    """A real mark as delivered, uniformly scaled into a d × d box centred on (0, 0)."""
    return embed(c, path, -d / 2, -d / 2, d)


def sparkle(x: float, y: float, r: float, fill: str, opacity=1.0, deg=0.0) -> str:
    """A four-point glint with pinched waists."""
    k = r * 0.16
    d = (
        f"M0 {n(-r)}Q{n(k)} {n(-k)} {n(r)} 0Q{n(k)} {n(k)} 0 {n(r)}Q{n(-k)} {n(k)} {n(-r)} 0Q{n(-k)} {n(-k)} 0 {n(-r)}Z"
    )
    return f'<path transform="translate({n(x)} {n(y)}) rotate({n(deg)})" d="{d}" fill="{fill}" opacity="{n(opacity)}"/>'


def glint(x: float, y: float, r: float, tone: str, deg: float = 0.0) -> str:
    """A sparkle that holds on either theme's ground: a toned glint with a paler core."""
    return sparkle(x, y, r, tone, 0.95, deg) + sparkle(x, y, r * 0.45, mix(tone, WHITE, 0.6), 0.95, deg)


def taper(points, width: float, power: float = 0.8) -> str:
    """A streak of light along a polyline: a filled outline widest at its middle and drawn out to nothing at both
    ends, so it reads as light caught, never as a drawn line."""
    last = len(points) - 1
    outer, inner = [], []
    for i, (px, py) in enumerate(points):
        (ox, oy), (qx, qy) = points[max(i - 1, 0)], points[min(i + 1, last)]
        length = math.hypot(qx - ox, qy - oy) or 1
        nx, ny = -(qy - oy) / length, (qx - ox) / length
        w = width / 2 * math.sin(math.pi * i / last) ** power
        outer.append((px + nx * w, py + ny * w))
        inner.append((px - nx * w, py - ny * w))
    return pts(outer + inner[::-1])


def rivets(points, r: float, c: Canvas) -> str:
    """Small domed gold rivets on a fitting."""
    paint = c.rad([(0, GOLD["light"]), (0.6, GOLD["mid"]), (1, GOLD["shadow"])], 0.35, 0.3, 0.7)
    return "".join(
        f'<circle cx="{n(x + r * 0.25)}" cy="{n(y + r * 0.35)}" r="{n(r)}" fill="{GOLD["shadow"]}" fill-opacity=".7"/>'
        f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(r)}" fill="{paint}"/>'
        for x, y in points
    )


def arc_points(cx: float, cy: float, rx: float, ry: float, a0: float, a1: float, steps: int = 24):
    return [
        (cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / steps)), cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / steps)))
        for i in range(steps + 1)
    ]
