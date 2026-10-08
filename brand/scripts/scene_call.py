"""Scene 1 · Call the next move. A lacquer tablet carries an inlaid gold line that wanders, then climbs past a dashed
silver line (the window's line) to a glowing head. Two lacquer dishes hover beside it, one carrying a gold up-chevron
(lifted, nearest) and one a silver down-chevron (lower, further): the two calls. No prices, no payout figure, no
promise of which way it goes."""
import random

from keyart import tablet
from kit import FIELD, GOLD, INK, SILVER, WHITE, Canvas, contact, field, n, rot, shade, soft_ellipse
from props import dish, sparkle

KEY = "scene-call"
COLOR = FIELD["pink"]
SEED = 1505
TABLET_AT, TABLET_W, TABLET_H, TABLET_R, TABLET_TILT = (330, 560), 470, 560, 58, -6
# The line in tablet coordinates: x from left to right edge (share of width), y as a share of height (0 = top).
LINE_X = (-0.40, 0.36)
LINE_POINTS = 26
LINE_Y0, LINE_Y1 = 0.18, -0.24  # start (lower) and end (higher), shares of the tablet's height from its centre
WANDER = 0.035
CLIMB_FROM = 0.55  # share of the way along where the line commits upward
DASH_Y = 0.02  # the window's line, just below centre
DASH, GAP = 16, 11
HEAD_R, HALO_R = 11, 54
UP_AT, UP_R = (606, 252), 98
DOWN_AT, DOWN_R = (612, 812), 74
TABLET_DEPTH, DOWN_DEPTH, UP_DEPTH, GLINT_DEPTH = 0.4, 0.7, 1.0, 0.2
MOTION = {"subject": "tablet", "mostMotion": ["up", "down"]}


def line_points(rng: random.Random) -> list[tuple[float, float]]:
    """The price line: a quiet wander, then a committed climb (smoothstep) past the dashed line."""
    out = []
    for i in range(LINE_POINTS):
        t = i / (LINE_POINTS - 1)
        x = (LINE_X[0] + (LINE_X[1] - LINE_X[0]) * t) * TABLET_W
        climb = max(0.0, (t - CLIMB_FROM) / (1 - CLIMB_FROM))
        ease = climb * climb * (3 - 2 * climb)
        base = LINE_Y0 + (LINE_Y1 - LINE_Y0) * ease
        jitter = 0.0 if i in (0, LINE_POINTS - 1) else rng.uniform(-WANDER, WANDER) * (1 - ease * 0.6)
        out.append((x, (base + jitter) * TABLET_H))
    return out


def smooth(points) -> str:
    """Catmull-Rom through the points, as cubic Béziers."""
    d = f"M{n(points[0][0])} {n(points[0][1])}"
    for i in range(1, len(points)):
        p0 = points[i - 2] if i > 1 else points[i - 1]
        p1, p2 = points[i - 1], points[i]
        p3 = points[i + 1] if i + 1 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f"C{n(c1[0])} {n(c1[1])} {n(c2[0])} {n(c2[1])} {n(p2[0])} {n(p2[1])}"
    return d


def chart(c: Canvas, pts_: list[tuple[float, float]]) -> str:
    """The inlay on the tablet: the dashed line, the gold price line in a hair of shade, and its glowing head."""
    w = TABLET_W
    y = DASH_Y * TABLET_H
    x0, x1 = -w * 0.44, w * 0.44
    dashes = "".join(
        f'<rect x="{n(x)}" y="{n(y - 1.6)}" width="{DASH}" height="3.2" rx="1.6"/>'
        for x in (x0 + k * (DASH + GAP) for k in range(int((x1 - x0) / (DASH + GAP))))
    )
    silver = c.lin([(0, SILVER["light"]), (0.5, SILVER["mid"]), (1, SILVER["shadow"])], 0, 0, 1, 0)
    d = smooth(pts_)
    gold = c.lin([(0, GOLD["shadow"]), (0.5, GOLD["mid"]), (0.85, GOLD["light"]), (1, "#FFF4C8")], 0, 0, 1, 0)
    hx, hy = pts_[-1]
    halo = c.rad([(0, GOLD["light"], 0.75), (0.35, GOLD["mid"], 0.28), (1, GOLD["mid"], 0)], 0.5, 0.5, 0.5)
    return (
        f'<g fill="{silver}" fill-opacity=".8">{dashes}</g>'
        f'<path d="{d}" fill="none" stroke="{INK}" stroke-opacity=".55" stroke-width="10" stroke-linecap="round"'
        f' stroke-linejoin="round" transform="translate(2 4)"/>'
        f'<path d="{d}" fill="none" stroke="{gold}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<circle cx="{n(hx)}" cy="{n(hy)}" r="{HALO_R}" fill="{halo}"/>'
        f'<circle cx="{n(hx)}" cy="{n(hy)}" r="{HEAD_R}" fill="#FFF4C8"/>'
        f'<circle cx="{n(hx - 3)}" cy="{n(hy - 3)}" r="{n(HEAD_R * 0.38)}" fill="{WHITE}"/>'
    )


def chevron(c: Canvas, r: float, up: bool, metal: dict) -> str:
    """A thick chevron inlaid in a dish, pointing up or down: metal with its shade line to the lower right."""
    s = 1 if up else -1
    a, b = r * 0.4, r * 0.24
    d = f"M{n(-a)} {n(s * b * 0.7)}L0 {n(-s * b)}L{n(a)} {n(s * b * 0.7)}"
    paint = c.lin([(0, metal["light"]), (0.5, metal["mid"]), (1, metal["shadow"])], 0, 0, 1, 1)
    width = r * 0.17
    return (
        f'<path d="{d}" fill="none" stroke="{INK}" stroke-opacity=".5" stroke-width="{n(width + 2)}"'
        f' stroke-linecap="round" stroke-linejoin="round" transform="translate(2 4)"/>'
        f'<path d="{d}" fill="none" stroke="{paint}" stroke-width="{n(width)}" stroke-linecap="round" stroke-linejoin="round"/>'
    )


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Call the next move: a gold line climbs past the dashed line on a lacquer tablet; Up and Down dishes hover (Senryo original)")
    rng = random.Random(SEED)
    field(c, COLOR)
    dark = shade(COLOR, 0.84)
    slab, slab_outline = tablet(c, TABLET_W, TABLET_H, TABLET_R, rng, COLOR)
    slab_t = f"translate({TABLET_AT[0]} {TABLET_AT[1]}) rotate({TABLET_TILT})"
    c.put("tablet-shadow", contact(slab_outline, dark, slab_t, 0.85), role="shadow", depth=TABLET_DEPTH, of="tablet")
    # The dishes hover: soft shadows on the ground below and right of them, travelling with the ground.
    for name, (x, y), r in (("down", DOWN_AT, DOWN_R), ("up", UP_AT, UP_R)):
        c.put(f"{name}-shadow", soft_ellipse(c, x + 18, y + r * 0.9, r * 0.82, r * 0.3, dark, 0.42), role="shadow", depth=TABLET_DEPTH, of=name)
    line = line_points(random.Random(SEED + 1))
    c.put("tablet", f'<g transform="{slab_t}">{slab}{chart(c, line)}</g>', depth=TABLET_DEPTH)
    silver_rim = (SILVER["shadow"], SILVER["mid"], SILVER["light"])
    gold_rim = (GOLD["shadow"], GOLD["mid"], GOLD["light"])
    c.put("down", f'<g transform="translate({DOWN_AT[0]} {DOWN_AT[1]}) rotate(8)">{dish(c, DOWN_R, silver_rim)}{chevron(c, DOWN_R, False, SILVER)}</g>', depth=DOWN_DEPTH)
    c.put("up", f'<g transform="translate({UP_AT[0]} {UP_AT[1]}) rotate(-10)">{dish(c, UP_R, gold_rim)}{chevron(c, UP_R, True, GOLD)}</g>', depth=UP_DEPTH)
    hx, hy = rot(line[-1], TABLET_TILT)
    head = (TABLET_AT[0] + hx, TABLET_AT[1] + hy)
    c.put(
        "glints",
        sparkle(head[0] + 34, head[1] - 46, 18, WHITE, 0.95, 10) + sparkle(head[0] + 70, head[1] - 12, 9, WHITE, 0.8, 25)
        + sparkle(118, 248, 14, WHITE, 0.8) + sparkle(84, 300, 7, WHITE, 0.6, 20)
        + sparkle(520, 900, 12, shade(COLOR, 0.6), 0.45),
        role="accent", depth=GLINT_DEPTH,
    )  # fmt: skip
    return f"{KEY}.svg", c.svg()

