"""Scene 4 · LP. The liquidity vault: a lacquer strong-well whose round, bolted door stands open on its hinges,
showing one shared pool inside. A single drop falls to the point where the surface is disturbed. It is a vault, built
differently from the balance chest on purpose, and it promises nothing: no rate, no yield figure, no instant exit."""
import math
import random

from kit import FIELD, GOLD, INK, LACQUER, SILVER, WHITE, Canvas, field, glyph_in, n, pts, sen, shade, soft_ellipse, sprinkle
from props import arc_points

KEY = "scene-lp"
COLOR = FIELD["lime"]
SEED = 1404
CX, TOP_Y, RX, RY = 372, 588, 268, 121  # the well's mouth (camera about 27° above the horizon)
WALL, PLINTH, PLINTH_OUT = 190, 26, 9
LIP = 30  # rim thickness seen from above
# The pool takes the app's own blues, light on top and deep at the far wall (tokens: link, primary, mainnet surface).
POOL = ("#DCE0FF", "#8B95FF", "#414EF4", "#1B2040")
DOOR_R, DOOR_SQUASH, DOOR_TILT, DOOR_THICK = 258, 0.8, -7, 16  # the open door: radius, foreshortening, lean
BOLTS, BOLT_W = 8, 20
HINGE_DX = 92
ANCHOR = 0.5  # depth of the vault and everything that is part of it
MOTION = {"subject": "well", "mostMotion": ["drop"]}
IMPACT = (CX + 8, TOP_Y + 54)  # where the drop lands: the centre of the disturbance
DROP_AT, DROP_SIZE = (CX + 8, 414), 28
RIPPLES = ((30, 0.95, 3), (62, 0.62, 2.6), (104, 0.34, 2.2))  # radius, opacity, width: fading as they spread
RIPPLE_SQUASH = 0.44
# Each ring is drawn only in broken lengths, different on every ring: (from angle, to angle, strength). Angles run
# clockwise from +x on screen; the near side (0–180) catches light, the far side (180–360) falls into shade.
ARCS_LIT = (
    ((30, 104, 1.0),),
    ((62, 132, 0.9), (150, 170, 0.25)),
    ((14, 58, 0.5), (96, 124, 0.3)),
)
ARCS_SHADE = (((206, 300, 0.8),), ((196, 244, 0.6), (268, 338, 0.5)), ((222, 286, 0.5),))


def ellipse(cx, cy, rx, ry, fill, extra="") -> str:
    return f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(rx)}" ry="{n(ry)}" fill="{fill}"{extra}/>'


def stroke(paint: str, width: float, opacity: float = 1.0) -> str:
    return f' stroke="{paint}" stroke-width="{n(width)}"' + (f' stroke-opacity="{n(opacity)}"' if opacity < 1 else "")


def well(c: Canvas, rng: random.Random) -> str:
    foot_y = TOP_Y + WALL
    wall_d = f"M{CX - RX} {TOP_Y}V{foot_y}A{RX} {RY} 0 0 0 {CX + RX} {foot_y}V{TOP_Y}A{RX} {RY} 0 0 1 {CX - RX} {TOP_Y}Z"
    plinth_rx, plinth_ry = RX + PLINTH_OUT, RY + PLINTH_OUT * RY / RX
    ledge_y = foot_y - PLINTH
    plinth_d = (
        f"M{CX - plinth_rx} {ledge_y}V{foot_y}A{plinth_rx} {n(plinth_ry)} 0 0 0 {CX + plinth_rx} {foot_y}V{ledge_y}"
        f"A{plinth_rx} {n(plinth_ry)} 0 0 1 {CX - plinth_rx} {ledge_y}Z"
    )
    turn = [(0, "#2A2231"), (0.1, "#3B3044"), (0.2, "#6A5A73"), (0.27, "#40344A"), (0.5, "#241D2B"), (0.82, "#130F18"), (0.94, "#1B1521"), (1, "#2A2231")]
    wall = c.lin(turn, 0, 0, 1, 0)
    ledge = c.lin([(0, "#4A3D54"), (0.4, "#2E2536"), (1, "#18121D")], 0, 0, 1, 0)
    bounce = c.lin([(0, COLOR, 0), (0.7, COLOR, 0.02), (1, COLOR, 0.2)], 0, 0, 0, 1)
    side_glow = c.lin([(0, COLOR, 0), (0.88, COLOR, 0), (1, COLOR, 0.26)], 0, 0, 1, 0)
    clip = c.clip(f'<path d="{wall_d}"/>')
    dust = sprinkle(rng, 420, (CX - RX, TOP_Y + 60, CX + RX, foot_y + RY), GOLD["mid"], (0.5, 1.5), lambda x, y: ((y - TOP_Y) / (WALL + RY)) ** 2.4)
    gold = c.lin([(0, GOLD["shadow"]), (0.22, GOLD["light"]), (0.5, GOLD["mid"]), (1, GOLD["shadow"])], 0, 0, 1, 0)
    band_y = TOP_Y + 40
    band = f'<path d="M{CX - RX} {band_y}A{RX} {RY} 0 0 0 {CX + RX} {band_y}" fill="none"{stroke(gold, 3)}/>'
    steel = c.lin([(0, SILVER["light"]), (0.5, SILVER["mid"]), (1, SILVER["shadow"])], 0, 0, 1, 1)
    catch_y = TOP_Y + RY + 22
    catch = (
        f'<rect x="{CX - 33}" y="{catch_y + 3}" width="70" height="58" rx="9" fill="{INK}" fill-opacity=".5"/>'
        f'<rect x="{CX - 35}" y="{catch_y}" width="70" height="58" rx="9" fill="{steel}"/>'
        f'<rect x="{CX - 35 + 1}" y="{catch_y + 1}" width="68" height="56" rx="8" fill="none"{stroke(WHITE, 1.6, 0.7)}/>'
        f'<rect x="{CX - 15}" y="{catch_y + 16}" width="30" height="26" rx="6" fill="#2B2331"/>'
        f'<rect x="{CX - 15}" y="{catch_y + 16}" width="30" height="8" rx="4" fill="#0C0910"/>'
    )
    in_rx, in_ry = RX - LIP, RY - LIP * 0.52
    lip = c.lin([(0, "#6B5B74"), (0.3, "#40344A"), (0.75, "#1E1824"), (1, "#3A2F42")], 0, 0, 1, 0.6)
    inner = c.lin([(0, "#0A070D"), (0.5, "#16111B"), (1, "#241D2B")], 0, 0, 1, 0)
    return (
        f'<g id="{KEY}-well-body"><path d="{plinth_d}" fill="{wall}"/><path d="{plinth_d}" fill="{INK}" fill-opacity=".3"/>'
        f"{ellipse(CX, ledge_y, plinth_rx, plinth_ry, ledge)}"
        f"{ellipse(CX, ledge_y, plinth_rx - 1, plinth_ry - 1, 'none', stroke(WHITE, 1.4, 0.28))}"
        f'<path d="{wall_d}" fill="{wall}"/>'
        f'<g clip-path="{clip}"><path d="{wall_d}" fill="{bounce}"/><path d="{wall_d}" fill="{side_glow}"/>{dust}{band}</g>{catch}'
        f"{ellipse(CX, TOP_Y, RX, RY, lip)}"
        f"{ellipse(CX, TOP_Y, RX - 1.2, RY - 1.2, 'none', stroke(WHITE, 2, 0.4))}"
        f"{ellipse(CX, TOP_Y + 3, in_rx, in_ry, inner)}</g>"
    )


def arc(cx: float, cy: float, rx: float, ry: float, a0: float, a1: float) -> str:
    """An open elliptical arc from angle a0 to a1 (degrees, clockwise on screen from the +x axis)."""
    points = arc_points(cx, cy, rx, ry, a0, a1, 14)
    return "M" + "L".join(f"{n(x)} {n(y)}" for x, y in points)


def pool(c: Canvas) -> tuple[str, str]:
    """The shared pool: lit toward the viewer, the far wall and the open door mirrored in it, the liquid climbing the
    near wall in a bright meniscus, and one disturbance where the drop lands: broken arcs of reflected light with
    shade behind them, fading as they spread, around a small dimple. Returns (surface, disturbance): the disturbance
    is its own layer, clipped to the pool."""
    in_rx, in_ry = RX - LIP, RY - LIP * 0.52
    y = TOP_Y + 30
    clip = c.clip(ellipse(CX, TOP_Y + 3, in_rx, in_ry, WHITE))
    water = c.rad([(0, POOL[0]), (0.3, POOL[1]), (0.72, POOL[2]), (1, POOL[3])], 0.4, 0.8, 0.86)
    far = c.lin([(0, POOL[3], 0.95), (0.22, POOL[3], 0.6), (0.5, POOL[3], 0)], 0, 0, 0, 1)
    wet = c.lin([(0.5, WHITE, 0), (0.8, WHITE, 0.5), (1, WHITE, 0.95)], 0, 0, 0, 1)
    glare = c.rad([(0, WHITE, 0.4), (0.6, WHITE, 0.1), (1, WHITE, 0)])
    ix, iy = IMPACT
    rings = ""
    for (r, a, w), lit, shaded in zip(RIPPLES, ARCS_LIT, ARCS_SHADE):
        ry = r * RIPPLE_SQUASH
        for a0, a1, k in lit:  # the near side of each ring catches the light, in broken lengths
            rings += f'<path d="{arc(ix, iy, r, ry, a0, a1)}" fill="none"{stroke(WHITE, w * 2.6, a * 0.22 * k)} stroke-linecap="round"/>'
            rings += f'<path d="{arc(ix, iy, r, ry, a0 + 4, a1 - 4)}" fill="none"{stroke(WHITE, w * 0.7, a * k)} stroke-linecap="round"/>'
        for a0, a1, k in shaded:  # the far side falls into shade
            rings += f'<path d="{arc(ix, iy, r, ry, a0, a1)}" fill="none"{stroke(POOL[3], w * 1.6, a * 0.34 * k)} stroke-linecap="round"/>'
    dimple = (
        f"{ellipse(ix, iy - 1, 17, 7, POOL[3], ' fill-opacity=\".16\"')}{ellipse(ix, iy - 1, 10, 4.2, POOL[3], ' fill-opacity=\".34\"')}"
        f'<path d="{arc(ix, iy, 11, 4.6, 20, 160)}" fill="none"{stroke(WHITE, 2.2, 0.9)} stroke-linecap="round"/>'
        f"{ellipse(ix + 1, iy - 13, 3.4, 4.4, POOL[0])}"
    )
    surface = (
        f'<g id="{KEY}-pool" clip-path="{clip}">{ellipse(CX, y, in_rx, in_ry, water)}{ellipse(CX, y, in_rx, in_ry, far)}'
        f"{ellipse(CX - in_rx * 0.42, y + in_ry * 0.42, in_rx * 0.4, in_ry * 0.3, glare)}"
        f"{ellipse(CX, y, in_rx - 2, in_ry - 2, 'none', stroke(wet, 5))}"
        f"{ellipse(CX, y, in_rx, in_ry, 'none', stroke(INK, 3, 0.4))}</g>"
        f"{ellipse(CX, TOP_Y + 3, in_rx, in_ry, 'none', stroke(INK, 1.6, 0.5))}"
    )
    return surface, f'<g clip-path="{clip}">{rings}{dimple}</g>'


def drop(c: Canvas, x: float, y: float, s: float) -> str:
    body = c.rad([(0, POOL[0]), (0.5, POOL[1]), (1, POOL[2])], 0.36, 0.6, 0.7)
    d = (
        f"M{n(x)} {n(y - s * 1.7)}C{n(x + s * 0.3)} {n(y - s * 0.8)} {n(x + s)} {n(y - s * 0.4)} {n(x + s)} {n(y + s * 0.15)}"
        f"A{n(s)} {n(s)} 0 0 1 {n(x - s)} {n(y + s * 0.15)}C{n(x - s)} {n(y - s * 0.4)} {n(x - s * 0.3)} {n(y - s * 0.8)} {n(x)} {n(y - s * 1.7)}Z"
    )
    return (
        f'<path d="{d}" fill="{body}"/><path d="{d}" fill="none"{stroke(POOL[3], 1.4, 0.5)}/>'
        f'<ellipse cx="{n(x - s * 0.36)}" cy="{n(y - s * 0.1)}" rx="{n(s * 0.2)}" ry="{n(s * 0.36)}" fill="{WHITE}" fill-opacity=".85" '
        f'transform="rotate(24 {n(x - s * 0.36)} {n(y - s * 0.1)})"/>'
    )


def door(c: Canvas) -> str:
    """The vault door, open on its hinges and leaning back: drawn as a disc in its own plane (the group is squashed
    to foreshorten it; written as scale(), because the identity codegen's SVGO pass rounds a merged transform to the
    precision of any matrix() it finds). Lacquer face, a recessed panel, drawn-back steel bolts around the rim, the seal at its centre."""
    r = DOOR_R
    face = c.lin([(0, "#6B5B74"), (0.3, "#3A2F42"), (1, "#18121D")], 0, 0, 1, 1)
    panel = c.lin([(0, "#17111C"), (0.6, "#231C29"), (1, "#30273A")], 0, 0, 1, 1)
    steel = c.lin([(0, SILVER["light"]), (0.5, SILVER["mid"]), (1, SILVER["shadow"])], 0, 0, 1, 1)
    gold = c.lin([(0, GOLD["light"]), (0.45, GOLD["mid"]), (1, GOLD["shadow"])], 0, 0, 1, 1)
    ring = c.lin([(0, GOLD["light"]), (0.5, GOLD["mid"]), (1, GOLD["shadow"])], 0, 0, 1, 0)
    sheen = c.lin([(0, WHITE, 0), (0.5, WHITE, 0.12), (1, WHITE, 0)], 0, 1, 1, 0)  # light sliding round the rim, fading at both ends
    bolts = ""
    for i in range(BOLTS):
        a = math.tau * (i + 0.5) / BOLTS
        (x0, y0), (x1, y1) = ((math.cos(a) * k, math.sin(a) * k) for k in (r * 0.86, r * 1.06))
        bolts += (
            f'<path d="M{n(x0)} {n(y0)}L{n(x1)} {n(y1)}" stroke="{SILVER["shadow"]}" stroke-width="{BOLT_W + 4}" stroke-linecap="round" transform="translate(3 4)"/>'
            f'<path d="M{n(x0)} {n(y0)}L{n(x1)} {n(y1)}" stroke="{steel}" stroke-width="{BOLT_W}" stroke-linecap="round"/>'
            f'<path d="M{n(x0)} {n(y0)}L{n(x1)} {n(y1)}" stroke="{WHITE}" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" transform="translate(-4 -4)"/>'
        )
    edge = "".join(f'<circle cx="{n(DOOR_THICK * k)}" cy="{n(DOOR_THICK * 0.8 * k)}" r="{r}" fill="{tone}"/>' for k, tone in ((1, "#09070C"), (0.66, "#120E17"), (0.33, "#1B1521")))
    streak = pts(arc_points(0, 0, r * 0.94, r * 0.94, 196, 250) + arc_points(0, 0, r * 0.82, r * 0.82, 250, 196))
    seal_r = r * 0.3
    glyph_t = glyph_in(-seal_r * 0.6, -seal_r * 0.62, seal_r * 1.2, seal_r * 1.2)
    panel_clip = c.clip(f'<circle r="{n(r * 0.78)}"/>')
    return (
        f'<g transform="scale(1 {DOOR_SQUASH})">{edge}{bolts}<circle r="{r}" fill="{face}"/>'
        f'<circle r="{n(r - 1.4)}" fill="none"{stroke(WHITE, 2.4, 0.45)}/>'
        f'<circle r="{n(r * 0.78)}" fill="{panel}"/>'
        f'<g clip-path="{panel_clip}"><circle r="{n(r * 0.78)}" fill="none"{stroke(INK, 26, 0.55)} transform="translate(9 11)"/></g>'
        f'<circle r="{n(r * 0.78)}" fill="none"{stroke(WHITE, 1.8, 0.25)}/>'
        f'<circle r="{n(r * 0.68)}" fill="none"{stroke(ring, 2.6)}/><circle r="{n(r * 0.64)}" fill="none"{stroke(ring, 1, 0.6)}/>'
        f'<path d="{streak}" fill="{sheen}"/>'
        f'<circle cx="2" cy="3" r="{n(seal_r)}" fill="{GOLD["shadow"]}"/><circle r="{n(seal_r)}" fill="{gold}"/>'
        f'<circle r="{n(seal_r - 8)}" fill="none"{stroke(GOLD["shadow"], 1.6, 0.6)}/>'
        f"{sen(f'translate(1.2 1.8) {glyph_t}', GOLD['light'], 34, 0.7)}{sen(glyph_t, LACQUER['shadow'], 34)}</g>"
    )


def hinges(c: Canvas) -> str:
    """Two strap hinges: a leaf riveted to the door, a leaf riveted to the well's rim, the knuckle between them."""
    steel = c.lin([(0, SILVER["light"]), (0.45, SILVER["mid"]), (1, SILVER["shadow"])], 0, 0, 0, 1)
    plate = c.lin([(0, SILVER["mid"]), (1, SILVER["shadow"])], 0, 0, 0, 1)
    y = TOP_Y - RY - 10
    out = ""
    for dx in (-HINGE_DX, HINGE_DX):
        x = CX + dx
        out += (
            f'<rect x="{n(x - 25)}" y="{n(y - 44)}" width="50" height="52" rx="8" fill="{INK}" fill-opacity=".4" transform="translate(3 3)"/>'
            f'<rect x="{n(x - 25)}" y="{n(y - 44)}" width="50" height="52" rx="8" fill="{plate}"/>'
            f'<path d="M{n(x - 25)} {n(y + 20)}H{n(x + 25)}L{n(x + 29)} {n(y + 38)}Q{n(x)} {n(y + 43)} {n(x - 29)} {n(y + 38)}Z" fill="{plate}"/>'
            f'<circle cx="{n(x - 11)}" cy="{n(y - 30)}" r="3.6" fill="{SILVER["mid"]}"/><circle cx="{n(x + 11)}" cy="{n(y - 30)}" r="3.6" fill="{SILVER["mid"]}"/>'
            f'<ellipse cx="{n(x - 12)}" cy="{n(y + 35)}" rx="3.6" ry="2.2" fill="{SILVER["light"]}"/><ellipse cx="{n(x + 12)}" cy="{n(y + 35)}" rx="3.6" ry="2.2" fill="{SILVER["light"]}"/>'
            f'<rect x="{n(x - 36)}" y="{n(y + 3)}" width="72" height="30" rx="13" fill="{INK}" fill-opacity=".5"/>'
            f'<rect x="{n(x - 36)}" y="{n(y)}" width="72" height="30" rx="13" fill="{steel}"/>'
            f'<rect x="{n(x - 30)}" y="{n(y + 5)}" width="60" height="5" rx="2.5" fill="{WHITE}" fill-opacity=".45"/>'
        )
    return out


def build() -> tuple[str, str]:
    c = Canvas(KEY, "LP: a lacquer vault well, its bolted round door open, one shared pool inside (Senryo original)")
    rng = random.Random(SEED)
    field(c, COLOR)
    dark = shade(COLOR, 0.82)
    foot_y = TOP_Y + WALL
    door_y = TOP_Y - RY - DOOR_R * DOOR_SQUASH + 22
    door_t = f"translate({CX - 6} {n(door_y)}) rotate({DOOR_TILT})"
    # The well, its door (held by the hinges) and the pool are one object: same depth. The ripples lie on the pool and
    # spread and fade on their own; the drop falls.
    c.put("well-shadow", soft_ellipse(c, CX + 60, foot_y + 34, RX * 1.2, RY * 0.9, dark, 0.5), soft_ellipse(c, CX + 8, foot_y + 14, RX * 1.04, RY * 0.9, dark, 0.6), role="shadow", depth=ANCHOR, of="well")
    c.put("door-shadow", soft_ellipse(c, CX + 30, door_y + 40, DOOR_R * 1.06, DOOR_R * DOOR_SQUASH * 1.04, dark, 0.34, DOOR_TILT), role="shadow", depth=ANCHOR, of="door")
    c.put("door", f'<g transform="{door_t}">{door(c)}</g>', depth=ANCHOR)
    surface, ripples = pool(c)
    c.put("well", well(c, rng), f'<g id="{KEY}-hinges">{hinges(c)}</g>', surface, depth=ANCHOR)
    c.put("ripples", ripples, role="accent", depth=ANCHOR)
    c.put("drop", drop(c, DROP_AT[0], DROP_AT[1], DROP_SIZE), role="accent", depth=1)
    return f"{KEY}.svg", c.svg()
