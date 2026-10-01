"""The senryō-bako (千両箱): the lacquer chest that is the one balance in scene 1. Drawn in the scene's standing
three-quarter view: each face is laid out flat in its own coordinates and placed by a matrix, so fittings, dust and
the two inlaid gold lines stay true to the face they sit on. The lines start at the lid's seal, cross the lid, run
down the front and leave at the foot of the chest, where the scene carries them on across the ground."""
import random

from kit import GOLD, INK, LACQUER, WHITE, Canvas, glyph_in, gloss, n, pts, sen, sprinkle
from props import rivets

# Oblique view from the front right, above: where each chest axis lands on screen.
EX, EY, EZ = (0.906, 0.211), (0.423, -0.453), (0.0, -0.866)
LENGTH, DEPTH, BODY_H, LID_H, LIP = 384, 250, 150, 58, 10
STRAP = 15  # width of a gold fitting strap
LINES = (0.25, 0.75)  # where the two inlaid lines cross the lid's front edge (share of the lid's length)
LINE_W = 4.4


def lid_size() -> tuple[float, float]:
    return LENGTH + 2 * LIP, DEPTH + 2 * LIP


def plane(u, v, origin) -> str:
    """SVG matrix that lays local (u right, v down) onto a chest face."""
    return f"matrix({n(u[0])} {n(u[1])} {n(v[0])} {n(v[1])} {n(origin[0])} {n(origin[1])})"


def bracket(w: float, h: float, corner: str) -> str:
    """An L-shaped corner fitting inside a w × h face; corner is 'bl' or 'br' (bottom) / 'tl' or 'tr'."""
    arm, s = 46, STRAP
    x0, x1 = (0, arm) if corner[1] == "l" else (w, w - arm)
    xs = s if corner[1] == "l" else w - s
    y0, y1 = (h, h - arm) if corner[0] == "b" else (0, arm)
    ys = h - s if corner[0] == "b" else s
    return pts([(x0, y0), (x1, y0), (x1, ys), (xs, ys), (xs, y1), (x0, y1)])


def inlay(d: str, paint: str) -> str:
    """A maki-e line: gold, with the faint shade a raised line throws."""
    return (
        f'<path d="{d}" fill="none" stroke="{GOLD["shadow"]}" stroke-width="{LINE_W + 1.2}" stroke-linecap="round" transform="translate(.8 1.4)" opacity=".7"/>'
        f'<path d="{d}" fill="none" stroke="{paint}" stroke-width="{LINE_W}" stroke-linecap="round"/>'
    )


def chest(c: Canvas, rng: random.Random, at, bounce_color: str, name: str) -> str:
    """`at(x, y, z)` maps chest space to the screen (the scene owns the origin)."""
    gold = c.lin([(0, GOLD["light"]), (0.45, GOLD["mid"]), (1, GOLD["shadow"])], 0, 0, 1, 1)
    gold_line = c.lin([(0, GOLD["light"]), (0.5, GOLD["mid"]), (1, "#EACF8C")], 0, 0, 1, 0)
    gold_fall = "#EACF8C"  # a vertical line has no box for a gradient to span: one flat foil tone
    top_h = BODY_H + LID_H
    lw, ld = lid_size()
    down = (0, -EZ[1])
    lines_lid = [lw * k for k in LINES]
    lines_body = [x - LIP for x in lines_lid]
    # --- body ---
    front = plane(EX, down, at(0, 0, BODY_H))
    side = plane(EY, down, at(LENGTH, 0, BODY_H))
    front_fill = c.lin([(0, "#0F0B13"), (0.2, "#2D2434"), (0.65, "#241D2B"), (1, "#1A1420")])
    front_light = c.lin([(0, WHITE, 0.1), (0.5, WHITE, 0.02), (1, WHITE, 0)], 0, 0, 1, 0)
    side_fill = c.lin([(0, "#09070C"), (0.25, "#1B1520"), (1, "#120E17")])
    bounce = c.lin([(0, bounce_color, 0), (0.55, bounce_color, 0.05), (1, bounce_color, 0.34)], 0, 0, 0.9, 1)
    dust = sprinkle(rng, 300, (0, 40, LENGTH, BODY_H), GOLD["mid"], (0.5, 1.4), lambda x, y: (1 - x / LENGTH) ** 2 * (y / BODY_H) ** 1.5)
    plate_w, plate_h = 66, 74
    px = (LENGTH - plate_w) / 2
    falls = "".join(inlay(f"M{n(x)} 0V{BODY_H}", gold_fall) for x in lines_body)
    body_front = (
        f'<g transform="{front}"><rect width="{LENGTH}" height="{BODY_H}" fill="{front_fill}"/>'
        f'<rect width="{LENGTH}" height="{BODY_H}" fill="{front_light}"/>{dust}{falls}'
        f'<path d="{bracket(LENGTH, BODY_H, "bl")}{bracket(LENGTH, BODY_H, "br")}" fill="{gold}"/>'
        f"{rivets([(8, BODY_H - 8), (36, BODY_H - 8), (8, BODY_H - 36), (LENGTH - 8, BODY_H - 8), (LENGTH - 36, BODY_H - 8), (LENGTH - 8, BODY_H - 36)], 2.6, c)}"
        f'<rect x="{n(px + 2)}" y="16" width="{plate_w}" height="{plate_h}" rx="9" fill="{INK}" fill-opacity=".45"/>'
        f'<rect x="{n(px)}" y="13" width="{plate_w}" height="{plate_h}" rx="9" fill="{gold}"/>'
        f'<rect x="{n(px + 5)}" y="18" width="{plate_w - 10}" height="{plate_h - 10}" rx="6" fill="none" stroke="{GOLD["shadow"]}" stroke-opacity=".55" stroke-width="1.4"/>'
        f"{rivets([(px + 12, 25), (px + plate_w - 12, 25), (px + 12, plate_h + 1), (px + plate_w - 12, plate_h + 1)], 2.4, c)}"
        f'<circle cx="{n(LENGTH / 2)}" cy="50" r="13" fill="none" stroke="{GOLD["shadow"]}" stroke-width="6.5"/>'
        f'<circle cx="{n(LENGTH / 2 - 1)}" cy="48.6" r="13" fill="none" stroke="{gold_line}" stroke-width="5"/>'
        "</g>"
    )
    body_side = (
        f'<g transform="{side}"><rect width="{DEPTH}" height="{BODY_H}" fill="{side_fill}"/>'
        f'<rect width="{DEPTH}" height="{BODY_H}" fill="{bounce}"/>'
        f'<path d="{bracket(DEPTH, BODY_H, "bl")}{bracket(DEPTH, BODY_H, "br")}" fill="{gold}" opacity=".82"/>'
        f'<rect x="{n(DEPTH / 2 - 30)}" y="38" width="60" height="26" rx="6" fill="{gold}" opacity=".85"/>'
        f'<path d="M{n(DEPTH / 2 - 22)} 56Q{n(DEPTH / 2 - 24)} 104 {n(DEPTH / 2)} 104Q{n(DEPTH / 2 + 24)} 104 {n(DEPTH / 2 + 22)} 56" fill="none" '
        f'stroke="{GOLD["shadow"]}" stroke-width="8" stroke-linecap="round"/>'
        f'<path d="M{n(DEPTH / 2 - 22)} 55Q{n(DEPTH / 2 - 24)} 102 {n(DEPTH / 2)} 102Q{n(DEPTH / 2 + 24)} 102 {n(DEPTH / 2 + 22)} 55" fill="none" '
        f'stroke="{GOLD["mid"]}" stroke-width="5" stroke-linecap="round"/>'
        "</g>"
    )
    # --- lid ---
    lid_front = plane(EX, down, at(-LIP, -LIP, top_h))
    lid_side = plane(EY, down, at(LENGTH + LIP, -LIP, top_h))
    lid_top = plane(EX, (-EY[0], -EY[1]), at(-LIP, DEPTH + LIP, top_h))
    lf_fill = c.lin([(0, "#4B3E54"), (0.12, "#372C3F"), (1, "#221B29")])
    ls_fill = c.lin([(0, "#241D2B"), (1, "#110D15")])
    top_fill = c.lin([(0, "#5A4B63"), (0.4, "#33293B"), (1, "#1E1824")], 0, 0, 1, 1)
    horizon = c.lin([(0, bounce_color, 0.2), (0.35, bounce_color, 0)], 0, 0, 0, 1)
    cx, cy, seal_r = lw * 0.5, ld * 0.46, 54
    # From the seal, one line bends to each side and comes forward to the lid's front edge.
    lid_lines = "".join(
        inlay(f"M{n(cx + side * seal_r * 0.74)} {n(cy + seal_r * 0.66)}C{n(cx + side * seal_r * 1.2)} {n(cy + seal_r * 1.3)} {n(x)} {n(ld - 70)} {n(x)} {n(ld)}", gold_line)
        for side, x in zip((-1, 1), lines_lid)
    )
    top_dust = sprinkle(rng, 420, (0, 0, lw, ld), GOLD["mid"], (0.5, 1.5), lambda x, y: (x / lw) ** 2.2 * (y / ld) ** 1.4)
    corner = 44
    plates = "".join(
        pts(p)
        for p in (
            [(0, 0), (corner, 0), (0, corner)],
            [(lw, 0), (lw - corner, 0), (lw, corner)],
            [(0, ld), (corner, ld), (0, ld - corner)],
            [(lw, ld), (lw - corner, ld), (lw, ld - corner)],
        )
    )
    streak = pts([(lw * 0.1, 0), (lw * 0.34, 0), (lw * 0.16, ld), (-lw * 0.08, ld)])
    streak2 = pts([(lw * 0.4, 0), (lw * 0.45, 0), (lw * 0.27, ld), (lw * 0.22, ld)])
    top_clip = c.clip(f'<rect width="{lw}" height="{ld}"/>')
    glyph_t = glyph_in(cx - 30, cy - 31, 60, 60)
    lid_falls = "".join(inlay(f"M{n(x)} 0V{LID_H}", gold_fall) for x in lines_lid)
    lid = (
        f'<g transform="{lid_side}"><rect width="{ld}" height="{LID_H}" fill="{ls_fill}"/>'
        f'<rect width="{ld}" height="{LID_H}" fill="{bounce}" opacity=".7"/></g>'
        f'<g transform="{lid_front}"><rect width="{lw}" height="{LID_H}" fill="{lf_fill}"/>{lid_falls}'
        f'<rect x="{n(lw / 2 - 20)}" y="0" width="40" height="{LID_H}" fill="{gold}"/>'
        f"{rivets([(lw / 2, 14), (lw / 2, LID_H - 14)], 2.6, c)}</g>"
        f'<g transform="{lid_top}"><rect width="{lw}" height="{ld}" fill="{top_fill}"/>'
        f'<g clip-path="{top_clip}"><rect width="{lw}" height="{ld}" fill="{horizon}"/>{top_dust}'
        f"{gloss(c, streak, 0.2, 0, 0, 0.3, 1)}{gloss(c, streak2, 0.11, 0, 0, 0.3, 1)}"
        f'<path d="{plates}" fill="{gold}"/>'
        f"{rivets([(11, 11), (lw - 11, 11), (11, ld - 11), (lw - 11, ld - 11)], 2.8, c)}{lid_lines}"
        f'<circle cx="{n(cx + 1)}" cy="{n(cy + 1.6)}" r="{seal_r}" fill="{GOLD["shadow"]}" opacity=".8"/>'
        f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{seal_r}" fill="{gold}"/>'
        f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{seal_r - 7}" fill="none" stroke="{GOLD["shadow"]}" stroke-opacity=".6" stroke-width="1.6"/>'
        f"{sen(f'translate(1 1.4) {glyph_t}', GOLD['light'], 34, 0.7)}{sen(glyph_t, LACQUER['shadow'], 34)}"
        "</g></g>"
    )
    # --- seams and lit edges (screen space) ---
    a, b, d = at(-LIP, -LIP, top_h), at(LENGTH + LIP, -LIP, top_h), at(LENGTH + LIP, DEPTH + LIP, top_h)
    e, f = at(-LIP, -LIP, BODY_H), at(LENGTH + LIP, -LIP, BODY_H)
    g, h = at(LENGTH, 0, BODY_H), at(LENGTH, 0, 0)
    edges = (
        f'<path d="M{n(a[0])} {n(a[1])}L{n(b[0])} {n(b[1])}" stroke="{WHITE}" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round"/>'
        f'<path d="M{n(b[0])} {n(b[1])}L{n(d[0])} {n(d[1])}" stroke="{WHITE}" stroke-opacity=".22" stroke-width="2"/>'
        f'<path d="M{n(e[0])} {n(e[1])}L{n(f[0])} {n(f[1])}" stroke="{INK}" stroke-opacity=".6" stroke-width="2.4"/>'
        f'<path d="M{n(b[0])} {n(b[1])}L{n(f[0])} {n(f[1])}M{n(g[0])} {n(g[1] + 4)}L{n(h[0])} {n(h[1])}" stroke="{WHITE}" stroke-opacity=".2" stroke-width="1.8"/>'
    )
    hull = pts([at(0, 0, 0), at(LENGTH, 0, 0), at(LENGTH, DEPTH, 0), at(LENGTH + LIP, DEPTH + LIP, BODY_H), at(LENGTH + LIP, DEPTH + LIP, top_h), at(-LIP, DEPTH + LIP, top_h), at(-LIP, -LIP, top_h), at(-LIP, -LIP, BODY_H), at(0, 0, BODY_H)])
    base = f'<path d="{hull}" fill="#100C14" stroke="#100C14" stroke-width="3" stroke-linejoin="round"/>'
    return f'<g id="{name}">{base}{body_side}{body_front}{lid}{edges}</g>'
