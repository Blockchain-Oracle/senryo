"""Completion foil. One square of beaten gold leaf with the seal pressed into it. The sheet is a computed surface:
a few broad, unequal bends, one lifted corner and a few sharp creases, calmer around the seal; its outline, the seal
and the creases are all projected from that surface. Its light is painted the same way the surface is built: each
bend turns the leaf toward or away from the light along its own direction, so each bend is one continuous gradient
laid across the whole sheet (light where it turns toward the lamp, shade where it turns away). No facets, no strips.
Layers: shadow · leaf · seal · sheen (the highlight alone, to sweep across the 千 after the verified outcome) · flakes.
Transparent ground: it sits on the dark and the light theme alike."""
import math
import random
import re

from kit import FOIL, GLYPH, GOLD, LACQUER, WHITE, Canvas, flakes, n, ramp, soft_ellipse

KEY = "completion-foil"
SIZE = 640
SEED = 1707
SHEET = 356  # edge of the leaf before projection
EDGE_STEPS = 40  # points along each side of the outline
YAW, PITCH = -22.0, 50.0  # the sheet turned on the table, then seen from above at an angle
CENTER = (298, 330)
# Broad bends: amplitude, direction in degrees on the sheet, cycles across it, phase.
BENDS = ((34.0, 18.0, 0.74, 0.5), (18.0, 112.0, 0.9, 1.9), (6.0, 62.0, 1.7, 0.3))
# Creases, drawn as hairlines that ride the surface: start u, v, direction in degrees, length (sheet units).
CREASES = ((0.72, 0.1, 62.0, 0.2), (0.08, 0.7, -24.0, 0.22), (0.88, 0.46, 100.0, 0.16))
CREASE_STEPS = 10
CURL_AT, CURL_LIFT = 1.4, 16.0  # the lifted corner: where u + v passes this, the leaf rises
CALM, CALM_SPREAD = 0.72, 0.24  # how much the bends flatten around the seal, and how far
LIGHT = (-0.5, -0.5)  # the lamp's direction across the sheet (it stands to the upper left)
TONE_MID, TONE_GAIN = 0.5, 1.05  # the leaf's resting tone on the foil ramp, and how hard a slope swings it
SHEEN_FROM, SHEEN_GAIN, SHEEN_MAX = 0.22, 1.5, 0.42  # where a turn toward the lamp starts to glare
BEND_STOPS = 28
FLAKE_DEPTH = 0.6
MOTION = {"subject": "leaf", "mostMotion": ["sheen"]}
SEAL_BOX = (0.28, 0.28, 0.44)  # u, v, size of the pressed seal on the sheet
DECKLE = 0.012
CURVE_STEPS = 6
SEAL_FRAME_STEPS = 14
PRESS, PRESS_DEPTH = "#2E1E05", (0.6, 0.34)  # the pressed seal: shade over the leaf, deeper on its shaded side, lighter where it is lit
SEAL_FRAME_W, SEAL_BOLD = 3.6, 5


def height(u: float, v: float) -> float:
    su, sv = SEAL_BOX[0] + SEAL_BOX[2] / 2, SEAL_BOX[1] + SEAL_BOX[2] / 2
    calm = 1 - CALM * math.exp(-((u - su) ** 2 + (v - sv) ** 2) / CALM_SPREAD**2)
    z = 0.0
    for amp, deg, cycles, phase in BENDS:
        a = math.radians(deg)
        z += amp * calm * math.sin(math.tau * cycles * (u * math.cos(a) + v * math.sin(a)) + phase)
    return z + CURL_LIFT * max(0.0, (u + v - CURL_AT) / (2 - CURL_AT)) ** 2


def flat(u: float, v: float) -> tuple[float, float]:
    """Where a point of the sheet lands on screen before any bending (the plane the paint is laid in)."""
    x, y = (u - 0.5) * SHEET, (v - 0.5) * SHEET
    a = math.radians(YAW)
    xr, yr = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
    return CENTER[0] + xr, CENTER[1] + yr * math.cos(math.radians(PITCH))


def project(u: float, v: float) -> tuple[float, float]:
    x, y = flat(u, v)
    return x, y - height(u, v) * math.sin(math.radians(PITCH))


def bend_light(amp: float, deg: float, cycles: float, phase: float, s: float) -> float:
    """How far one bend swings the leaf's tone at position s along the bend's own direction: its slope there, measured
    against the lamp (to first order a surface's shading is the sum of its bends' slopes toward the light)."""
    a = math.radians(deg)
    slope = amp * math.tau * cycles / SHEET * math.cos(math.tau * cycles * s + phase)
    return -TONE_GAIN * slope * (LIGHT[0] * math.cos(a) + LIGHT[1] * math.sin(a)) * 2


def bend_paints(c: Canvas, bend) -> tuple[str, str]:
    """(tone, sheen) gradients for one bend, laid across the whole sheet along the bend's direction on screen."""
    _, deg, _, _ = bend
    a = math.radians(deg)
    ax, ay = math.cos(a), math.sin(a)
    reach = [ax * u + ay * v for u, v in ((0, 0), (1, 0), (0, 1), (1, 1))]
    lo, hi = min(reach), max(reach)
    # Screen points of s = lo and s = hi on the line through the sheet's centre that runs across the bend's level lines.
    o, pu, pv = flat(0.5, 0.5), flat(1.5, 0.5), flat(0.5, 1.5)
    ux, uy, vx, vy = pu[0] - o[0], pu[1] - o[1], pv[0] - o[0], pv[1] - o[1]
    det = ux * vy - uy * vx
    wx, wy = (ax * vy - ay * uy) / det, (ay * ux - ax * vx) / det  # screen-space gradient of s
    w2 = wx * wx + wy * wy
    mid = ax * 0.5 + ay * 0.5
    (x1, y1), (x2, y2) = ((o[0] + wx * (s - mid) / w2, o[1] + wy * (s - mid) / w2) for s in (lo, hi))
    tone, sheen = [], []
    for k in range(BEND_STOPS + 1):
        swing = bend_light(*bend, lo + (hi - lo) * k / BEND_STOPS)
        if swing >= 0:
            tone.append((k / BEND_STOPS, FOIL[4], min(swing / (1 - TONE_MID), 1)))
        else:
            tone.append((k / BEND_STOPS, FOIL[0], min(-swing / TONE_MID, 1)))
        sheen.append((k / BEND_STOPS, WHITE, min(max(swing - SHEEN_FROM, 0) * SHEEN_GAIN, SHEEN_MAX)))
    return c.lin(tone, x1, y1, x2, y2, user=True), c.lin(sheen, x1, y1, x2, y2, user=True)


def glyph_points() -> list[list[tuple[float, float]]]:
    """The seal's 千 as polylines in font units (quadratics flattened)."""
    tokens = re.findall(r"[MLHVQZ]|-?\d*\.?\d+", GLYPH["d"])
    loops, cur, i, pos = [], [], 0, (0.0, 0.0)
    while i < len(tokens):
        cmd = tokens[i]
        i += 1
        if cmd == "Z":
            loops.append(cur)
            cur = []
            continue
        while i < len(tokens) and not tokens[i].isalpha():
            if cmd in "ML":
                pos = (float(tokens[i]), float(tokens[i + 1]))
                i += 2
                cur.append(pos)
            elif cmd == "H":
                pos = (float(tokens[i]), pos[1])
                i += 1
                cur.append(pos)
            elif cmd == "V":
                pos = (pos[0], float(tokens[i]))
                i += 1
                cur.append(pos)
            else:  # Q
                cx, cy, ex, ey = (float(t) for t in tokens[i : i + 4])
                i += 4
                for s in range(1, CURVE_STEPS + 1):
                    t = s / CURVE_STEPS
                    cur.append(
                        ((1 - t) ** 2 * pos[0] + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) ** 2 * pos[1] + 2 * (1 - t) * t * cy + t * t * ey)
                    )
                pos = (ex, ey)
    return loops


def on_sheet(loops, u0: float, v0: float, size: float) -> str:
    """Maps glyph polylines into a u/v box on the sheet and projects them."""
    x0, y0, x1, y1 = GLYPH["bbox"]
    s = size / max(x1 - x0, y1 - y0)
    ox, oy = u0 + (size - (x1 - x0) * s) / 2, v0 + (size - (y1 - y0) * s) / 2
    out = []
    for loop in loops:
        mapped = [project(ox + (x - x0) * s, oy + (y - y0) * s) for x, y in loop]
        out.append("M" + "L".join(f"{n(x)} {n(y)}" for x, y in mapped) + "Z")
    return "".join(out)


def frame(u0: float, v0: float, size: float) -> str:
    steps = SEAL_FRAME_STEPS
    ring = (
        [(u0 + size * i / steps, v0) for i in range(steps)]
        + [(u0 + size, v0 + size * i / steps) for i in range(steps)]
        + [(u0 + size - size * i / steps, v0 + size) for i in range(steps)]
        + [(u0, v0 + size - size * i / steps) for i in range(steps)]
    )
    return "M" + "L".join(f"{n(x)} {n(y)}" for x, y in (project(u, v) for u, v in ring)) + "Z"


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Completion foil: a flexing sheet of gold leaf with the seal pressed in (Senryo original)", SIZE, SIZE)
    rng = random.Random(SEED)

    def deckle(count: int) -> list[float]:
        """A torn edge is a slow wander with a little grit, not a sawtooth."""
        waves = [(rng.uniform(0.5, 1), rng.uniform(1.5, 6), rng.uniform(0, math.tau)) for _ in range(3)]
        return [DECKLE * (sum(a * math.sin(f * math.tau * k / count + ph) for a, f, ph in waves) / 2 + rng.uniform(-0.25, 0.25)) for k in range(count + 1)]

    top, right, bottom, left = (deckle(EDGE_STEPS) for _ in range(4))
    steps = [k / EDGE_STEPS for k in range(EDGE_STEPS + 1)]
    ring = (
        [(t, top[k]) for k, t in enumerate(steps)]
        + [(1 + right[k], t) for k, t in enumerate(steps)]
        + [(1 - t, 1 + bottom[k]) for k, t in enumerate(steps)]
        + [(left[k], 1 - t) for k, t in enumerate(steps)]
    )
    edge = "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in (project(u, v) for u, v in ring)) + "Z"
    paints = [bend_paints(c, bend) for bend in BENDS]
    # Around the seal the bends flatten, so their light and shade fade back to the leaf's resting tone there.
    su, sv = SEAL_BOX[0] + SEAL_BOX[2] / 2, SEAL_BOX[1] + SEAL_BOX[2] / 2
    rest = ramp(FOIL, TONE_MID)
    calm = c.rad([(0, rest, CALM * 0.75), (0.45, rest, CALM * 0.5), (1, rest, 0)])
    cx, cy = project(su, sv)
    spread = CALM_SPREAD * SHEET * 2.1
    corner = project(1, 1)
    lifted = [(u, v) for u, v in ring if u + v > CURL_AT + 0.24]
    under = "M" + "L".join(f"{x + 0.6:.1f} {y + 2.2:.1f}" for x, y in (project(u, v) for u, v in lifted))
    curl = c.rad([(0, FOIL[4], 0.6), (0.5, FOIL[4], 0.2), (1, FOIL[4], 0)])
    clip = c.clip(f'<path d="{edge}"/>')
    leaf = (
        f'<path d="{edge}" fill="{rest}"/>'
        + "".join(f'<path d="{edge}" fill="{tone}"/>' for tone, _ in paints)
        + f'<g clip-path="{clip}">'
        f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(spread)}" ry="{n(spread * math.cos(math.radians(PITCH)))}" fill="{calm}" transform="rotate({YAW} {n(cx)} {n(cy)})"/>'
        f'<ellipse cx="{n(corner[0])}" cy="{n(corner[1])}" rx="{n(SHEET * 0.34)}" ry="{n(SHEET * 0.2)}" fill="{curl}"/></g>'
    )
    u0, v0, size = SEAL_BOX
    glyph_d = on_sheet(glyph_points(), u0 + size * 0.17, v0 + size * 0.17, size * 0.66)
    frame_d = frame(u0, v0, size)
    # The impression: shade over the leaf's own surface (the gold underneath still shows its bends). Light catches
    # only the far edges of the hollow, and only as strongly as the leaf around them is lit.
    hollow = f'<path d="{frame_d}" fill="none" stroke-width="{SEAL_FRAME_W}"/><path d="{glyph_d}" stroke-width="{SEAL_BOLD}"/>'
    outside = c.mask(f'<rect width="{SIZE}" height="{SIZE}" fill="#FFFFFF"/><g fill="#000000" stroke="#000000" stroke-linejoin="round">{hollow}</g>')
    press = c.lin([(0, PRESS, PRESS_DEPTH[0]), (1, PRESS, PRESS_DEPTH[1])], *project(u0, v0), *project(u0 + size, v0 + size), user=True)
    catch = c.lin([(0, FOIL[4], 0.9), (0.55, FOIL[4], 0.45), (1, FOIL[4], 0.1)], *project(u0, v0), *project(u0 + size, v0 + size), user=True)
    seal = (
        f'<g mask="{outside}"><g fill="{catch}" stroke="{catch}" stroke-linejoin="round" transform="translate(1.2 1.7)">{hollow}</g></g>'
        f'<g fill="{press}" stroke="{press}" stroke-linejoin="round">{hollow}</g>'
    )
    creases = []
    for cu, cv, deg, length in CREASES:
        a = math.radians(deg)
        line = [project(cu + length * k / CREASE_STEPS * math.cos(a), cv + length * k / CREASE_STEPS * math.sin(a)) for k in range(CREASE_STEPS + 1)]
        creases.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in line))
    crease_d = "".join(creases)
    rim = c.lin([(0, GOLD["light"], 0.9), (0.5, GOLD["light"], 0.1), (1, GOLD["shadow"], 0.9)], 0, 0, 1, 1)
    c.put(
        "shadow",
        soft_ellipse(c, CENTER[0] + 14, CENTER[1] + 100, 204, 54, LACQUER["shadow"], 0.28, YAW * 0.4),
        soft_ellipse(c, corner[0] - 30, corner[1] + 34, 70, 20, LACQUER["shadow"], 0.3, -14),
        role="shadow", depth=1, of="leaf",
    )  # fmt: skip
    c.put(
        "leaf",
        leaf,
        f'<path d="{crease_d}" fill="none" stroke="{FOIL[4]}" stroke-opacity=".16" stroke-width="9" stroke-linecap="round" transform="translate(3 4.4)"/>'
        f'<path d="{crease_d}" fill="none" stroke="{GOLD["shadow"]}" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/>'
        f'<path d="{crease_d}" fill="none" stroke="{GOLD["light"]}" stroke-opacity=".7" stroke-width=".9" stroke-linecap="round" transform="translate(.9 1.3)"/>',
        f'<path d="{edge}" fill="none" stroke="{FOIL[1]}" stroke-opacity=".7" stroke-width="1.2"/><path d="{edge}" fill="none" stroke="{rim}" stroke-width="1"/>'
        f'<path d="{under}" fill="none" stroke="{FOIL[0]}" stroke-width="2.6" stroke-linecap="round"/>',  # the lifted corner shows a line of its underside
        depth=1,
    )
    c.put("seal", seal, depth=1)
    c.put("sheen", "".join(f'<path d="{edge}" fill="{sheen}"/>' for _, sheen in paints[:2]), role="accent", depth=1)
    c.put("flakes", flakes(c, rng, [(96, 176, 10), (128, 142, 5), (566, 486, 11), (598, 444, 5)]), role="accent", depth=FLAKE_DEPTH)
    return f"{KEY}.svg", c.svg()
