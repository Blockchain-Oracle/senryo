"""Scene 2 · Payouts land on their own. The lacquer senryō-bako (千両箱, the brand's namesake: the one balance) waits
while three gold koban fall to it in an arc, the lowest about to land on the lid in a small burst of light. Nothing
is claimed, carried or pressed: the coins arrive by themselves. No amounts, no rate, no timer."""
import random

from chest import DEPTH, EX, EY, EZ, LENGTH, LID_H, BODY_H, chest, lid_size
from kit import FIELD, GOLD, WHITE, Canvas, embed, field, n, pts, shade, soft_ellipse, soft_path
from props import sparkle

KEY = "scene-payout"
COLOR = FIELD["orange"]
SEED = 1606
ORIGIN = (178, 640)  # front-bottom-left corner of the chest's body
ANCHOR = 0.4
MOTION = {"subject": "chest", "mostMotion": ["coin-high", "coin-mid", "coin-low"]}
# Falling koban: centre, size, tilt, depth (the highest travels most), from the far one to the one about to land.
COINS = (
    ("coin-high", (548, 128), 150, 18, 1.0),
    ("coin-mid", (446, 252), 172, -12, 0.85),
    ("coin-low", (356, 360), 196, 6, 0.7),
)
KOBAN = "brand/art/xau-koban.svg"
STREAK_LEN, STREAK_W = 70, 3.2
BURST_R = 46


def at(x: float, y: float, z: float) -> tuple[float, float]:
    return (
        ORIGIN[0] + x * EX[0] + y * EY[0] + z * EZ[0],
        ORIGIN[1] + x * EX[1] + y * EY[1] + z * EZ[1],
    )


def streaks(c: Canvas, x: float, y: float, size: float) -> str:
    """Two fading foil streaks above a falling coin: the way it came."""
    gold = c.lin([(0, GOLD["light"], 0), (1, GOLD["light"], 0.75)], 0, 0, 0, 1)
    out = ""
    for dx, length in ((-size * 0.16, STREAK_LEN), (size * 0.14, STREAK_LEN * 0.7)):
        x0, y1 = x + dx, y - size * 0.42
        out += f'<path d="M{n(x0 - 10)} {n(y1 - length)}L{n(x0)} {n(y1)}" stroke="{gold}" stroke-width="{STREAK_W}" stroke-linecap="round"/>'
    return out


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Payouts land on their own: gold koban fall to the lacquer senryō-bako (Senryo original)")
    rng = random.Random(SEED)
    field(c, COLOR)
    dark = shade(COLOR, 0.86)
    foot = [at(0, 0, 0), at(LENGTH, 0, 0), at(LENGTH, DEPTH, 0), at(0, DEPTH, 0)]
    sx, sy = at(LENGTH + 10, DEPTH * 0.4, 0)
    c.put("chest-shadow", soft_ellipse(c, sx, sy, LENGTH * 0.5, DEPTH * 0.32, dark, 0.34, 13), soft_path(pts(foot), 9, dark, 0.55), role="shadow", depth=ANCHOR, of="chest")
    # Each coin's shadow falls on the lid: closer (and darker) the lower the coin.
    lw, ld = lid_size()
    lid_top = BODY_H + LID_H
    for name, (x, y), size, _, depth in COINS:
        near = (y - COINS[0][1][1]) / (COINS[-1][1][1] - COINS[0][1][1])
        lx, ly = at(lw * (0.3 + 0.35 * near), ld * 0.5, lid_top)
        c.put(f"{name}-shadow", soft_ellipse(c, lx, ly, size * 0.34, size * 0.12, dark, 0.18 + 0.3 * near), role="shadow", depth=ANCHOR, of=name)
    c.put("chest", chest(c, rng, at, COLOR, f"{KEY}-chest-body"), depth=ANCHOR)
    for name, (x, y), size, tilt, depth in COINS:
        coin = embed(c, KOBAN, -size / 2, -size / 2, size)
        c.put(name, streaks(c, x, y, size), f'<g transform="translate({x} {y}) rotate({tilt})">{coin}</g>', depth=depth)
    bx, by = at(lw * 0.62, ld * 0.55, lid_top)
    burst = c.rad([(0, "#FFF4C8", 0.9), (0.4, GOLD["light"], 0.35), (1, GOLD["light"], 0)], 0.5, 0.5, 0.5)
    c.put(
        "glints",
        f'<circle cx="{n(bx)}" cy="{n(by)}" r="{BURST_R}" fill="{burst}"/>'
        + sparkle(bx + 30, by - 26, 16, WHITE, 0.95, 12) + sparkle(bx - 40, by - 8, 9, WHITE, 0.8, 30)
        + sparkle(122, 210, 14, WHITE, 0.8) + sparkle(660, 420, 10, WHITE, 0.7, 20)
        + sparkle(640, 860, 12, shade(COLOR, 0.6), 0.45),
        role="accent", depth=0.2,
    )  # fmt: skip
    return f"{KEY}.svg", c.svg()
