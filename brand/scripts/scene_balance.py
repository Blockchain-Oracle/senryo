"""Scene 1 · One balance. A lacquer senryō-bako (千両箱, the thousand-ryō chest the brand is named for) is the one
balance. Two gold maki-e lines leave the seal on its lid, run down its front and carry on across the ground as inlaid
paths: one to spending (the Kinpaku card), one to trading (the XAU koban). Both start at the same seal: the same
money can take either path. No amounts, no partition, nothing split."""
import random

from chest import DEPTH, EX, EY, EZ, LENGTH, LINES, LIP, chest, lid_size
from kit import FIELD, GOLD, Canvas, field, n, pts, shade, soft_ellipse, soft_path
from props import CARD_RATIO, kinpaku_card, koban_dish

KEY = "scene-balance"
COLOR = FIELD["orange"]
SEED = 1101
ORIGIN = (150, 484)  # front-bottom-left corner of the chest's body
CARD_AT, CARD_W, CARD_TILT = (176, 706), 286, -8  # centre of the hovering card
KOBAN_AT, KOBAN_R = (574, 710), 100  # centre of the hovering koban dish
PADS = ((176, 852), (574, 856))  # where each path lands on the ground, under its object
PAD_RX, PAD_RY = 104, 40
ANCHOR = 0.4  # depth of the chest and everything fixed to the ground with it
MOTION = {"subject": "chest", "mostMotion": ["card", "koban"]}
PATH_W, PATH_CORE = 5, 3.4
RING_W, RING_CORE = 3, 2  # the destination rings are quieter than the paths that reach them


def at(x: float, y: float, z: float) -> tuple[float, float]:
    return (
        ORIGIN[0] + x * EX[0] + y * EY[0] + z * EZ[0],
        ORIGIN[1] + x * EX[1] + y * EY[1] + z * EZ[1],
    )


def ground_path(c: Canvas, start, pad, bend: float) -> str:
    """An inlaid path in the ground: it leaves the foot of the chest, comes forward and meets its ring. Flat: a gold
    line in a hair of shade, no thickness and no cast shadow."""
    gold = c.lin([(0, GOLD["mid"]), (0.5, GOLD["light"]), (1, GOLD["mid"])], 0, 0, 0, 1)
    end = (pad[0] + bend * 0.1, pad[1] - PAD_RY)
    d = f"M{n(start[0])} {n(start[1])}C{n(start[0] - 20)} {n(start[1] + 60)} {n(end[0] + bend)} {n(end[1] - 110)} {n(end[0])} {n(end[1])}"
    return (
        f'<g stroke-linecap="round" fill="none">'
        f'<path d="{d}" stroke="{shade(COLOR, 0.45)}" stroke-width="{PATH_W}"/>'
        f'<path d="{d}" stroke="{gold}" stroke-width="{PATH_CORE}"/></g>'
    )


def pad(c: Canvas, at_pad) -> str:
    """Where a path arrives: a ring inlaid in the ground, the same gold line, around a shallow darker circle."""
    x, y = at_pad
    gold = c.lin([(0, GOLD["light"]), (0.5, GOLD["mid"]), (1, GOLD["light"])], 0, 0, 1, 0)
    return (
        f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="{PAD_RX}" ry="{PAD_RY}" fill="{shade(COLOR, 0.2)}"/>'
        f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="{PAD_RX}" ry="{PAD_RY}" fill="none" stroke="{shade(COLOR, 0.32)}" stroke-width="{RING_W}"/>'
        f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="{PAD_RX}" ry="{PAD_RY}" fill="none" stroke="{gold}" stroke-opacity=".7" stroke-width="{RING_CORE}"/>'
    )


def build() -> tuple[str, str]:
    c = Canvas(KEY, "One balance: a lacquer senryō-bako with two inlaid paths, to the Kinpaku card and the koban (Senryo original)")
    rng = random.Random(SEED)
    field(c, COLOR)
    dark = shade(COLOR, 0.86)
    foot = [at(0, 0, 0), at(LENGTH, 0, 0), at(LENGTH, DEPTH, 0), at(0, DEPTH, 0)]
    sx, sy = at(LENGTH + 10, DEPTH * 0.4, 0)
    # Chest, paths and rings are one rigid group (the lines run from the lid onto the ground): same depth. The card and
    # the koban hover over their rings and travel most; their shadows stay on the ground.
    c.put("chest-shadow", soft_ellipse(c, sx, sy, LENGTH * 0.5, DEPTH * 0.32, dark, 0.34, 13), soft_path(pts(foot), 9, dark, 0.55), role="shadow", depth=ANCHOR, of="chest")
    lw, _ = lid_size()
    starts = [at(lw * k - LIP, 0, 0) for k in LINES]
    hover = [soft_ellipse(c, x + 6, y + 2, PAD_RX * 0.74, PAD_RY * 0.66, dark, 0.62) for x, y in PADS]
    c.put("path-spend", ground_path(c, starts[0], PADS[0], -30), role="ground", depth=ANCHOR)
    c.put("path-trade", ground_path(c, starts[1], PADS[1], 40), role="ground", depth=ANCHOR)
    c.put("pad-spend", pad(c, PADS[0]), role="ground", depth=ANCHOR)
    c.put("card-shadow", hover[0], role="shadow", depth=ANCHOR, of="card")
    c.put("pad-trade", pad(c, PADS[1]), role="ground", depth=ANCHOR)
    c.put("koban-shadow", hover[1], role="shadow", depth=ANCHOR, of="koban")
    c.put("chest", chest(c, rng, at, COLOR, f"{KEY}-chest-body"), depth=ANCHOR)
    card, _ = kinpaku_card(c, CARD_W)
    card_h = CARD_W / CARD_RATIO
    card_t = f"translate({CARD_AT[0]} {CARD_AT[1]}) rotate({CARD_TILT}) translate({n(-CARD_W / 2)} {n(-card_h / 2)})"
    c.put("card", f'<g transform="{card_t}">{card}</g>', depth=1)
    c.put("koban", f'<g transform="translate({KOBAN_AT[0]} {KOBAN_AT[1]})">{koban_dish(c, KOBAN_R)}</g>', depth=1)
    return f"{KEY}.svg", c.svg()
