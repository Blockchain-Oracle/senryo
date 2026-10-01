"""Face ID primer art: an ebi-jō, the Edo shrimp lock, opened. Its body is a black lacquer tube sown with gold dust
and capped in gold; the shackle is a gold bar bent like a shrimp's back, lifted out of its socket so the bolt's steel
spring leaves show. Four corners of light frame it, the way a look is framed; it is not the system's Face ID glyph.
Transparent ground: it hovers over its own soft shadow.

Layers (back to front): shadow · shackle (lifts and swings about its fixed leg: moves most) · body · glints (the
corners of light).
The static master is the Reduced Motion composition: open, nothing missing."""
import math
import random

from kit import FOIL, GOLD, INK, LACQUER, MAINNET, SILVER, WHITE, Canvas, gloss, mix, n, pts, rot, seal_tile, soft_ellipse, sprinkle
from props import taper

KEY = "primer-face-id"
SIZE = 640
SEED = 1911
MOTION = {"subject": "body", "mostMotion": ["shackle"]}
BODY_AT, BODY_TILT = (332, 398), -4.0  # the tube's centre and lean
BODY_L, BODY_R, END_SQUASH, BULGE = 284, 72, 0.36, 0.08  # tube length, radius at its ends; end face foreshortening; barrel swell
CAP_W, CAP_FLARE, CAP_EDGE = 30, 1.09, 8  # the gold caps: width, how far they stand proud of the lacquer, the near end's thickness
LOBES, LOBE, LOBE_STEPS = 6, 8, 72  # the caps' kiku edge: petals across the near half, how far each reaches onto the lacquer
KNOB_R, KNOB_NECK = 15, 9  # the finial on the far end
FIXED_X, SOCKET_X = -88, 86  # where the shackle's fixed leg and its socket stand on the tube
BOSS_R, BOSS_H, BOSS_SQUASH = 22, 13, 0.42  # the gold bosses the shackle's legs enter
ROD_W = 26  # the shackle's bar
BEATEN = ("92 5 61 4 118 6 400", "40 7 88 5 52 9 400")  # the bar's highlights break where the leaf was beaten over it
ARCH_RISE, ARCH_LEAN = 128, 0.14  # how high the shackle arches over the tube, and how far its crown leans to the fixed leg
LIFT, SWING = 32, -4.0  # the shackle open: drawn up out of its socket and swung about its fixed leg
BOLT_W, BOLT_L, LEAF_W = 13, 46, 6  # the bolt below the bar, and the width of its spring leaves
LEAVES = ((-1, 21, 29), (1, 16, 25))  # each leaf: its side, how far it springs out, its length (never quite a pair)
SEAL = 62  # the gold seal tile inlaid in the lacquer
SHADOW_DROP = 108  # the tube's shadow, this far below its axis
FRAME_BOX, FRAME_ARM, FRAME_R, FRAME_W = (108, 112, 532, 520), 80, 15, 7.5  # the corners of light: box, arm, bend radius, width at the bend
FRAME_INSET, FRAME_ACCENT, FRAME_TAPER = 7, 3.2, 0.35  # the blue line just inside each corner: inset, width; how late both thin out
CORNER_STEPS = 10
TINT = MAINNET["pale"]  # the light the gold and lacquer pick up: the app's link blue, as on the pending-passkey art


def swell(x: float, r: float = BODY_R) -> float:
    """The barrel's radius at x along its axis: it swells a little toward the middle, as a turned and lacquered body does."""
    return r * (1 + BULGE * (1 - (2 * x / BODY_L) ** 2))


def tube_outline(x0: float, x1: float, r: float, steps: int = 16) -> str:
    """A length of the barrel from x0 to x1 seen side on, the far end's rounded silhouette on the left."""
    xs = [x0 + (x1 - x0) * k / steps for k in range(steps + 1)]
    top = "L".join(f"{n(x)} {n(-swell(x, r))}" for x in xs)
    bottom = "L".join(f"{n(x)} {n(swell(x, r))}" for x in reversed(xs))
    r0 = swell(x0, r)
    return f"M{top}L{bottom}A{n(r0 * END_SQUASH)} {n(r0)} 0 0 1 {n(x0)} {n(-r0)}Z"


def round_paint(c: Canvas, stops) -> str:
    """Shading across the tube (top → bottom): a horizontal cylinder lit from above and to the left."""
    return c.lin(stops, 0, 0, 0.08, 1)


def body(c: Canvas, rng: random.Random) -> str:
    """The tube in its own frame: axis along +x, centre at the origin."""
    h, r = BODY_L / 2, BODY_R
    lacquer = round_paint(c, [(0, "#7A6984"), (0.1, "#4A3D54"), (0.28, LACQUER["mid"]), (0.6, LACQUER["shadow"]), (0.8, "#08060A"), (0.94, "#1B1521"), (1, "#2E2538")])
    bounce = c.lin([(0, TINT, 0), (0.78, TINT, 0), (1, TINT, 0.3)], 0, 0, 0, 1)
    gold = round_paint(c, [(0, FOIL[3]), (0.1, WHITE), (0.2, FOIL[4]), (0.4, FOIL[2]), (0.66, FOIL[1]), (0.86, FOIL[0]), (1, FOIL[1])])
    tube = tube_outline(-h, h, r)
    clip = c.clip(f'<path d="{tube}"/>')
    dust = sprinkle(rng, 520, (-h, -r, h, r), GOLD["mid"], (0.5, 1.5), lambda x, y: 0.15 + 0.85 * ((x + h) / (2 * h)) ** 1.4 * ((y + r) / (2 * r)) ** 1.2)
    streak = pts([(-h, -r * 0.76), (h, -r * 0.76), (h, -r * 0.46), (-h, -r * 0.46)])
    caps = ""
    for x0, x1, lobed in ((-h - 2, -h + CAP_W, 1), (h - CAP_W, h, -1)):
        caps += f'<path d="{cap_outline(x0, x1, lobed)}" fill="{gold}"/>'
        # the kiku edge against the lacquer: its lip catches the lamp, the lacquer beside it lies in its shade
        edge = "M" + "L".join(f"{n(x)} {n(y)}" for x, y in petals(x1 if lobed > 0 else x0, lobed))
        caps += (
            f'<path d="{edge}" fill="none" stroke="{INK}" stroke-opacity=".5" stroke-width="3.6" transform="translate({1.8 * lobed} 1)"/>'
            f'<path d="{edge}" fill="none" stroke="{FOIL[3]}" stroke-width="1.4"/>'
        )
        for k in (0.36, 0.6):  # two engraved rings round each cap
            x = x0 + (x1 - x0) * (k if lobed > 0 else 1 - k)
            rc = swell(x) * CAP_FLARE
            caps += (
                f'<path d="M{n(x)} {n(-rc)}V{n(rc)}" stroke="{FOIL[0]}" stroke-opacity=".6" stroke-width="1.4"/>'
                f'<path d="M{n(x + 1.4)} {n(-rc)}V{n(rc)}" stroke="{WHITE}" stroke-opacity=".35" stroke-width="1"/>'
            )
    end = end_face(c, h, swell(h) * CAP_FLARE)
    finial = knob(c, -h - 2 - swell(-h) * CAP_FLARE * END_SQUASH)
    bosses = "".join(boss(c, x, -swell(x), hole=x == SOCKET_X) for x in (FIXED_X, SOCKET_X))
    seal_x, seal_y = (FIXED_X + SOCKET_X) / 2 - SEAL / 2, -SEAL / 2 + 4
    return (
        f'<path d="{tube}" fill="{lacquer}"/>'
        f'<g clip-path="{clip}"><path d="{tube}" fill="{bounce}"/>{dust}{gloss(c, streak, 0.42, 0, 0, 1, 0)}'
        f'<path d="M{n(-h)} {n(-r * 0.66)}H{n(h)}" stroke="{WHITE}" stroke-opacity=".5" stroke-width="1.6"/>'
        f'<path d="M{n(-h)} {n(-r + 1.4)}H{n(h)}" stroke="{WHITE}" stroke-opacity=".3" stroke-width="2"/></g>'
        f'<rect x="{n(seal_x + 2)}" y="{n(seal_y + 3)}" width="{SEAL}" height="{SEAL}" rx="5" fill="{INK}" fill-opacity=".5"/>'
        f"{seal_tile(c, seal_x, seal_y, SEAL)}"
        f"{finial}{caps}{end}{bosses}"
    )


def petals(x: float, lobed: int) -> list[tuple[float, float]]:
    """A cap's kiku (chrysanthemum) edge at x, top to bottom: petals evenly spaced round the barrel, so they crowd
    together toward its top and bottom where the surface turns away; `lobed` is the side they reach toward."""
    out = []
    for k in range(LOBE_STEPS + 1):
        phi = math.pi * (k / LOBE_STEPS - 0.5)
        reach = LOBE * abs(math.sin(LOBES * phi)) ** 0.6
        out.append((x + lobed * reach, swell(x) * CAP_FLARE * math.sin(phi)))
    return out


def cap_outline(x0: float, x1: float, lobed: int) -> str:
    """A gold cap from x0 to x1 with its kiku edge on the lacquer side (+1: the far cap, petals reaching right)."""
    r0, r1 = swell(x0) * CAP_FLARE, swell(x1) * CAP_FLARE
    if lobed > 0:
        return f"M{n(x0)} {n(-r0)}L" + "L".join(f"{n(x)} {n(y)}" for x, y in petals(x1, 1)) + f"L{n(x0)} {n(r0)}A{n(r0 * END_SQUASH)} {n(r0)} 0 0 1 {n(x0)} {n(-r0)}Z"
    return "M" + "L".join(f"{n(x)} {n(y)}" for x, y in petals(x0, -1)) + f"L{n(x1)} {n(r1)}V{n(-r1)}Z"


def end_face(c: Canvas, x: float, r: float) -> str:
    """The near end of the tube, facing right and away from the lamp: a gold disc with a raised rim and the keyhole."""
    rx = r * END_SQUASH
    face = c.lin([(0, FOIL[2]), (0.45, FOIL[1]), (1, FOIL[0])], 0, 0, 1, 1)
    rim = c.lin([(0, GOLD["light"]), (0.4, FOIL[3]), (0.7, FOIL[1]), (1, FOIL[0])], 0, 0, 1, 1)
    k = r * 0.12  # the keyhole: a round bore over a slot that narrows, foreshortened with the face
    slot = (
        f"M{n(x - k * 0.5)} {n(-k * 0.2)}A{n(k * 0.62)} {n(k)} 0 1 1 {n(x + k * 0.5)} {n(-k * 0.2)}"
        f"L{n(x + k * 0.5)} {n(k * 2.6)}H{n(x - k * 0.5)}Z"
    )
    edge = c.lin([(0, FOIL[1]), (1, FOIL[0])], 0, 0, 1, 1)
    return (
        f'<ellipse cx="{n(x + CAP_EDGE * 0.7)}" cy="{n(CAP_EDGE * 0.3)}" rx="{n(rx)}" ry="{n(r)}" fill="{edge}"/>'
        f'<ellipse cx="{n(x + CAP_EDGE * 0.35)}" cy="{n(CAP_EDGE * 0.15)}" rx="{n(rx)}" ry="{n(r)}" fill="{FOIL[1]}"/>'
        f'<ellipse cx="{n(x)}" rx="{n(rx)}" ry="{n(r)}" fill="{face}"/>'
        f'<ellipse cx="{n(x)}" rx="{n(rx - 1.4)}" ry="{n(r - 1.4)}" fill="none" stroke="{rim}" stroke-width="2.8"/>'
        f'<ellipse cx="{n(x)}" rx="{n(rx * 0.62)}" ry="{n(r * 0.66)}" fill="none" stroke="{FOIL[0]}" stroke-opacity=".7" stroke-width="1.6"/>'
        f'<ellipse cx="{n(x + 0.6)}" rx="{n(rx * 0.62)}" ry="{n(r * 0.66)}" fill="none" stroke="{GOLD["light"]}" stroke-opacity=".5" stroke-width="1" transform="translate(.8 1.2)"/>'
        f'<path d="{slot}" fill="{GOLD["light"]}" fill-opacity=".7" transform="translate(1 1.4)"/><path d="{slot}" fill="{LACQUER["shadow"]}"/>'
    )


def knob(c: Canvas, x: float) -> str:
    """The finial on the far end: a turned gold knob on a short neck."""
    paint = c.rad([(0, WHITE), (0.25, FOIL[4]), (0.6, FOIL[2]), (1, FOIL[0])], 0.36, 0.3, 0.7)
    neck = c.lin([(0, FOIL[3]), (0.4, FOIL[2]), (1, FOIL[0])], 0, 0, 0, 1)
    cx = x - KNOB_NECK - KNOB_R * 0.7
    return (
        f'<rect x="{n(cx)}" y="{n(-KNOB_R * 0.42)}" width="{n(x - cx + 2)}" height="{n(KNOB_R * 0.84)}" rx="3" fill="{neck}"/>'
        f'<circle cx="{n(cx + 1.6)}" cy="2.2" r="{KNOB_R}" fill="{FOIL[0]}"/><circle cx="{n(cx)}" r="{KNOB_R}" fill="{paint}"/>'
    )


def boss(c: Canvas, x: float, y: float, hole: bool) -> str:
    """A short gold boss standing on the tube where a leg of the shackle goes in; the socket shows its dark hole."""
    r, top = BOSS_R, y - BOSS_H
    side = c.lin([(0, FOIL[1]), (0.18, WHITE), (0.32, FOIL[4]), (0.6, FOIL[2]), (0.86, FOIL[0]), (1, FOIL[1])], 0, 0, 1, 0)
    cap = c.lin([(0, GOLD["light"]), (0.6, FOIL[3]), (1, FOIL[1])], 0, 0, 1, 1)
    ry = r * BOSS_SQUASH
    hr = BOLT_W * 0.95  # the socket the bolt drops into: a dark bore with a lit far lip
    socket = (
        f'<ellipse cx="{n(x)}" cy="{n(top)}" rx="{n(hr + 2)}" ry="{n((hr + 2) * BOSS_SQUASH)}" fill="{FOIL[0]}"/>'
        f'<ellipse cx="{n(x)}" cy="{n(top + 0.6)}" rx="{n(hr)}" ry="{n(hr * BOSS_SQUASH)}" fill="#08060A"/>'
        f'<path d="M{n(x - hr)} {n(top + 0.6)}A{n(hr)} {n(hr * BOSS_SQUASH)} 0 0 0 {n(x + hr)} {n(top + 0.6)}" fill="none" stroke="{GOLD["light"]}" stroke-opacity=".7" stroke-width="1.2"/>'
        if hole
        else ""
    )
    return (
        f'<path d="M{n(x - r)} {n(top)}V{n(y + 2)}A{n(r)} {n(ry)} 0 0 0 {n(x + r)} {n(y + 2)}V{n(top)}Z" fill="{side}"/>'
        f'<ellipse cx="{n(x)}" cy="{n(top)}" rx="{n(r)}" ry="{n(ry)}" fill="{cap}"/>'
        f'<ellipse cx="{n(x)}" cy="{n(top)}" rx="{n(r - 1)}" ry="{n(ry - 0.6)}" fill="none" stroke="{WHITE}" stroke-opacity=".55" stroke-width="1.2"/>'
        f"{socket}"
    )


def shackle_path() -> str:
    """The bar's centre line in the shackle's frame (origin where the fixed leg enters its boss): down into the boss,
    up the fixed leg, over in a shrimp's arch whose crown leans toward the fixed side, down to the free leg's end."""
    span = SOCKET_X - FIXED_X
    leg = ARCH_RISE * 0.3
    return (
        f"M0 {n(BOSS_H * 2)}V{n(-leg)}"
        f"C0 {n(-ARCH_RISE * 1.18)} {n(span * (1 - ARCH_LEAN) + 10)} {n(-ARCH_RISE * 1.22)} {n(span)} {n(-leg)}"
        f"V{n(-BOLT_L * 0.6)}"
    )


def shackle(c: Canvas) -> str:
    """The gold bar, round in section and lit from the upper left on every bend (offset strokes, each inside the last),
    and the steel bolt at its free end with its two spring leaves splayed back like a shrimp's tail."""
    d = shackle_path()
    span = SOCKET_X - FIXED_X
    sweep = c.lin([(0, FOIL[3]), (0.4, FOIL[2]), (1, FOIL[1])], -40, -ARCH_RISE * 1.1, span + 40, 0, user=True)
    rod = (
        f'<path d="{d}" fill="none" stroke="{FOIL[0]}" stroke-width="{ROD_W}" stroke-linecap="round"/>'
        f'<path d="{d}" fill="none" stroke="{sweep}" stroke-width="{ROD_W - 7}" stroke-linecap="round" transform="translate(-2.4 -2.4)"/>'
        f'<path d="{d}" fill="none" stroke="{FOIL[4]}" stroke-width="7" stroke-linecap="round" stroke-dasharray="{BEATEN[0]}" transform="translate(-5.4 -5.4)"/>'
        f'<path d="{d}" fill="none" stroke="{WHITE}" stroke-opacity=".9" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="{BEATEN[1]}" transform="translate(-6.6 -6.6)"/>'
        f'<path d="{d}" fill="none" stroke="{mix(TINT, FOIL[2], 0.5)}" stroke-opacity=".45" stroke-width="2.4" stroke-linecap="round" transform="translate(8.6 8.6)"/>'
    )
    steel = c.lin([(0, SILVER["light"]), (0.4, SILVER["mid"]), (1, SILVER["shadow"])], 0, 0, 1, 0)
    tip = BOLT_L * 0.4  # the bolt runs from the bar's end down to here
    top = -BOLT_L * 0.6
    bolt = f'<rect x="{n(span - BOLT_W / 2)}" y="{n(top)}" width="{BOLT_W}" height="{n(tip - top)}" rx="3" fill="{steel}"/>'
    leaves = ""
    for side, spread, length in LEAVES:  # flat springs riveted at the bolt's tip and sprung out: what the key presses flat
        root, end = (span + side * BOLT_W * 0.25, tip - 2), (span + side * spread, tip - length)
        dx, dy = end[0] - root[0], end[1] - root[1]
        k = LEAF_W / 2 / (dx * dx + dy * dy) ** 0.5
        nx, ny = -dy * k, dx * k  # a strip of spring steel: narrow where it is riveted, cut square at its free end
        leaf = pts([(root[0] + nx * 0.6, root[1] + ny * 0.6), (end[0] + nx, end[1] + ny), (end[0] - nx, end[1] - ny), (root[0] - nx * 0.6, root[1] - ny * 0.6)])
        leaves += (
            f'<path d="{leaf}" fill="{SILVER["light"] if side < 0 else SILVER["mid"]}" stroke="{SILVER["shadow"]}" stroke-width="1.2" stroke-linejoin="round"/>'
        )
    collar = c.lin([(0, FOIL[3]), (0.3, WHITE), (0.5, FOIL[3]), (1, FOIL[0])], 0, 0, 1, 0)
    ring_y = -BOLT_L * 0.6 - 4
    collar_d = f'<rect x="{n(span - ROD_W / 2 - 2)}" y="{n(ring_y)}" width="{ROD_W + 4}" height="10" rx="4" fill="{collar}"/>'
    return f"{rod}{bolt}{leaves}{collar_d}"


def corner_line(cx: float, cy: float, sx: int, sy: int, inset: float = 0.0) -> list[tuple[float, float]]:
    """One corner's centre line, from the end of one arm round the bend to the end of the other, `inset` toward the
    frame's middle."""
    cx, cy, r, arm = cx + sx * inset, cy + sy * inset, FRAME_R - inset, FRAME_ARM - inset
    bend = (cx + sx * r, cy + sy * r)
    line = [(cx, cy + sy * (arm - k * (arm - r) / CORNER_STEPS)) for k in range(CORNER_STEPS)]
    line += [(bend[0] - sx * r * math.cos(t), bend[1] - sy * r * math.sin(t)) for t in (math.pi / 2 * k / CORNER_STEPS for k in range(CORNER_STEPS + 1))]
    return line + [(cx + sx * (r + k * (arm - r) / CORNER_STEPS), cy) for k in range(1, CORNER_STEPS + 1)]


def corners(c: Canvas) -> str:
    """Four corners of light round the lock, the frame a look is caught in: each a streak of gold widest at its bend
    and drawn out to nothing along both arms, with a thread of the app's blue just inside it. Light caught, never a
    drawn bracket, and no face inside it."""
    x0, y0, x1, y1 = FRAME_BOX
    out = ""
    for cx, cy, sx, sy in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x1, y1, -1, -1), (x0, y1, 1, -1)):
        focus = (cx + sx * FRAME_R * 0.3, cy + sy * FRAME_R * 0.3)
        fade = c.rad([(0, GOLD["mid"], 1), (0.65, GOLD["mid"], 0.7), (1, GOLD["mid"], 0)], *focus, FRAME_ARM, user=True)
        blue = c.rad([(0, TINT, 1), (0.7, TINT, 0.75), (1, TINT, 0)], *focus, FRAME_ARM, user=True)
        out += f'<path d="{taper(corner_line(cx, cy, sx, sy), FRAME_W, FRAME_TAPER)}" fill="{fade}"/>'
        out += f'<path d="{taper(corner_line(cx, cy, sx, sy, FRAME_INSET), FRAME_ACCENT, FRAME_TAPER)}" fill="{blue}"/>'
    return out


def on_canvas(p) -> tuple[float, float]:
    """A point in the tube's own frame, on the canvas."""
    x, y = rot(p, BODY_TILT)
    return BODY_AT[0] + x, BODY_AT[1] + y


PIVOT = (FIXED_X, -swell(FIXED_X) - BOSS_H)  # the top of the fixed leg's boss: the shackle lifts and swings about it
PIVOTS = {"shackle": on_canvas(PIVOT)}  # in master units, for layers.json


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Face ID primer: an ebi-jō lock opened, its shackle lifted (Senryo original)", SIZE, SIZE)
    rng = random.Random(SEED)
    body_t = f"translate({BODY_AT[0]} {BODY_AT[1]}) rotate({BODY_TILT})"
    shackle_t = f"{body_t} translate({n(PIVOT[0])} {n(PIVOT[1])}) translate(0 {-LIFT}) rotate({SWING})"
    shadow_x = BODY_AT[0] + 18
    c.put(
        "shadow",
        soft_ellipse(c, shadow_x, BODY_AT[1] + SHADOW_DROP, BODY_L * 0.66, 32, LACQUER["shadow"], 0.22, BODY_TILT * 0.5),
        soft_ellipse(c, shadow_x - 10, BODY_AT[1] + SHADOW_DROP - 4, BODY_L * 0.44, 13, LACQUER["shadow"], 0.16, BODY_TILT * 0.5),
        role="shadow", depth=0.5, of="body",
    )  # fmt: skip
    c.put("shackle", f'<g transform="{shackle_t}">{shackle(c)}</g>', depth=1)
    c.put("body", f'<g transform="{body_t}">{body(c, rng)}</g>', depth=0.5)
    c.put("glints", corners(c), role="accent", depth=0.3)  # light only: a star on the frame would turn it into ornament
    return f"{KEY}.svg", c.svg()
