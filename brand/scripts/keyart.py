"""The Senryo passkey object: an original silver key whose bow is the seal's own rounded square, its lacquer tag, and
the lacquer tablet with the key-shaped bed it settles into. Shared by scene 2 and the pending-passkey art.
This is authored artwork, not the passkey glyph: the Material Symbols glyph (packages/identity) stays flat, upright and
labelled on the controls, exactly as its usage rules require."""
import math
import random

from kit import GOLD, INK, LACQUER, SILVER, WHITE, Canvas, carved_seal, gloss, n, pts, rrect, seal_tile, sprinkle

BOW, BOW_R, HOLE, HOLE_R = 170, 46, 64, 18
SHAFT_HALF, KEY_LEN = 19, 470
TEETH = ((372, 30, 52), (414, 30, 34))  # x, width, drop below the shaft
TOOTH_R = 6
KEY_THICK = 10
KEY_BOX = (0, -BOW / 2, KEY_LEN, BOW / 2 + 56)  # local bounding box (x0, y0, x1, y1)
TAG_W, TAG_H = 96, 132


def key_outline() -> str:
    """The key lying along +x: bow at the origin side, bit pointing right. One closed path plus the bow's hole."""
    h, r, s = BOW / 2, BOW_R, SHAFT_HALF
    d = [f"M{r} {-h}H{BOW - r}A{r} {r} 0 0 1 {BOW} {-h + r}V{-s - 12}Q{BOW} {-s} {BOW + 12} {-s}"]
    d.append(f"H{KEY_LEN - s}A{s} {s} 0 0 1 {KEY_LEN - s} {s}")
    for x, w, drop in reversed(TEETH):
        d.append(
            f"H{x + w}V{s + drop - TOOTH_R}A{TOOTH_R} {TOOTH_R} 0 0 1 {x + w - TOOTH_R} {s + drop}H{x + TOOTH_R}"
            f"A{TOOTH_R} {TOOTH_R} 0 0 1 {x} {s + drop - TOOTH_R}V{s}"
        )
    d.append(f"H{BOW + 12}Q{BOW} {s} {BOW} {s + 12}V{h - r}A{r} {r} 0 0 1 {BOW - r} {h}H{r}A{r} {r} 0 0 1 0 {h - r}V{-h + r}A{r} {r} 0 0 1 {r} {-h}Z")
    hole = rrect((BOW - HOLE) / 2, -HOLE / 2, HOLE, HOLE, HOLE_R)
    return "".join(d) + hole


def local(vec, tilt: float) -> tuple[float, float]:
    """A screen-space direction expressed in the key's own (rotated) coordinates."""
    a = math.radians(-tilt)
    return vec[0] * math.cos(a) - vec[1] * math.sin(a), vec[0] * math.sin(a) + vec[1] * math.cos(a)


def key(c: Canvas, tilt: float, tint: str) -> str:
    """The key in local coordinates, lit for a final rotation of `tilt` degrees. `tint` is the colour the metal picks
    up from its surroundings (the scene field)."""
    d = key_outline()
    lx, ly = local((-0.7071, -0.7071), tilt)  # toward the light
    ex, ey = local((0.55, 1.0), tilt)  # thickness falls to the lower right on screen
    x0, y0, x1, y1 = KEY_BOX
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    span = 150
    face = c.lin(
        [(0, WHITE), (0.16, SILVER["light"]), (0.34, SILVER["mid"]), (0.47, "#8791A4"), (0.53, SILVER["light"]), (0.6, WHITE), (0.72, SILVER["mid"]), (0.9, "#7B8598"), (1, "#A9B1C1")],
        cx + lx * span, cy + ly * span, cx - lx * span, cy - ly * span, user=True,
    )  # fmt: skip
    bevel = c.lin(
        [(0, WHITE, 0.95), (0.42, WHITE, 0.1), (0.58, SILVER["shadow"], 0.1), (1, "#4A5262", 0.85)],
        cx + lx * span, cy + ly * span, cx - lx * span, cy - ly * span, user=True,
    )  # fmt: skip
    clip = c.clip(f'<path d="{d}" clip-rule="evenodd"/>')
    edge = "".join(
        f'<path d="{d}" fill-rule="evenodd" transform="translate({n(ex * KEY_THICK * k)} {n(ey * KEY_THICK * k)})" '
        f'fill="{tone}"/>'
        for k, tone in ((1, "#4B5362"), (0.5, "#566072"))
    )
    groove = f"M{BOW + 26} -4H{KEY_LEN - 44}"
    streak = pts([(18, -BOW / 2), (58, -BOW / 2), (BOW - 30, BOW / 2), (BOW - 70, BOW / 2)])
    return (
        f"{edge}"
        f'<path d="{d}" fill-rule="evenodd" fill="{face}"/>'
        f'<g clip-path="{clip}">'
        f'<path d="{d}" fill="none" stroke="{tint}" stroke-opacity=".22" stroke-width="16" transform="translate({n(-lx * 7)} {n(-ly * 7)})"/>'
        f"{gloss(c, streak, 0.55, 0, 0, 1, 0)}"
        f'<path d="{groove}" stroke="{SILVER["shadow"]}" stroke-opacity=".75" stroke-width="5" stroke-linecap="round"/>'
        f'<path d="{groove}" stroke="{WHITE}" stroke-opacity=".8" stroke-width="1.6" stroke-linecap="round" transform="translate({n(-lx * 3)} {n(-ly * 3)})"/>'
        f'<path d="{d}" fill="none" stroke="{bevel}" stroke-width="9" stroke-linejoin="round"/>'
        "</g>"
        f'<path d="{d}" fill="none" stroke="#3F4654" stroke-opacity=".55" stroke-width="1"/>'
    )


def key_bed(c: Canvas, tilt: float) -> str:
    """The recess in the lacquer where the key belongs. Quiet on purpose: barely darker than the tablet, shaded under
    its lit edge and catching a thin light on the far edge, so it reads as a hollow and never as a second key."""
    d = key_outline()
    lx, ly = local((-0.7071, -0.7071), tilt)
    clip = c.clip(f'<path d="{d}" clip-rule="evenodd"/>')
    x0, y0, x1, y1 = KEY_BOX
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    lit = c.lin([(0.5, WHITE, 0), (1, WHITE, 0.34)], cx + lx * 160, cy + ly * 160, cx - lx * 160, cy - ly * 160, user=True)
    return (
        f'<path d="{d}" fill-rule="evenodd" fill="{INK}" fill-opacity=".1"/>'
        f'<g clip-path="{clip}"><path d="{d}" fill="none" stroke="{INK}" stroke-opacity=".3" stroke-width="8" '
        f'transform="translate({n(lx * 3)} {n(ly * 3)})"/></g>'
        f'<path d="{d}" fill="none" stroke="{lit}" stroke-width="1.6"/>'
    )


def tag_outline() -> str:
    """The tag's silhouette (origin = its hole), for its shadow."""
    return rrect(-TAG_W / 2, -18, TAG_W, TAG_H, 20)


def tag(c: Canvas) -> str:
    """A small lacquer tag carrying the seal, hole at the top centre (origin = the hole)."""
    w, h, r = TAG_W, TAG_H, 20
    x, y = -w / 2, -18
    face = c.lin([(0, LACQUER["light"]), (0.4, LACQUER["mid"]), (1, LACQUER["shadow"])], 0, 0, 1, 1)
    rim = c.lin([(0, WHITE, 0.6), (0.5, WHITE, 0.03), (1, INK, 0.5)], 0, 0, 1, 1)
    edge = f'<path d="{rrect(x + 2, y + 3.4, w, h, r)}" fill="#0D0A11"/>'
    tile = 52
    return (
        f"{edge}"
        f'<path d="{rrect(x, y, w, h, r)}" fill="{face}"/>'
        f'<path d="{rrect(x + 1, y + 1, w - 2, h - 2, r)}" fill="none" stroke="{rim}" stroke-width="2"/>'
        f'<path d="{rrect(x + 3.5, y + 3.5, w - 7, h - 7, r - 3)}" fill="none" stroke="{GOLD["mid"]}" stroke-width="2.4"/>'
        f'<circle r="8.5" fill="#0A080D"/><circle r="8.5" fill="none" stroke="{GOLD["mid"]}" stroke-width="2.2"/>'
        f"{seal_tile(c, -tile / 2, 30, tile)}"
    )


def tablet(c: Canvas, w: float, h: float, r: float, rng: random.Random, bounce: str, rim_light: float = 0.0) -> tuple[str, str]:
    """A lacquer tablet face up, origin at its centre. Returns (markup, outline). `rim_light` (0..1) draws a reflected
    edge along the lower right of its thickness, so the dark body keeps its outline on a dark ground."""
    x, y = -w / 2, -h / 2
    outline = rrect(x, y, w, h, r)
    face = c.lin([(0, "#55465E"), (0.32, LACQUER["mid"]), (1, LACQUER["shadow"])], 0, 0, 1, 1)
    rim = c.lin([(0, WHITE, 0.6), (0.4, WHITE, 0.04), (0.6, INK, 0.05), (1, INK, 0.55)], 0, 0, 1, 1)
    glow = c.lin([(0, bounce, 0), (0.7, bounce, 0.03), (1, bounce, 0.26)], 0, 0, 1, 1)
    clip = c.clip(f'<path d="{outline}"/>')
    edge = "".join(f'<path d="{rrect(x + k * 9, y + k * 15, w, h, r)}" fill="{tone}"/>' for k, tone in ((1, "#0A070D"), (0.66, "#120E17"), (0.33, "#1B1521")))
    band = pts([(x + w * 0.12, y), (x + w * 0.44, y), (x + w * 0.1, y + h), (x - w * 0.22, y + h)])
    dust = sprinkle(rng, 520, (x, y, x + w, y + h), GOLD["mid"], (0.5, 1.6), lambda px, py: ((px - x) / w) ** 2 * ((py - y) / h) ** 2.4)
    under = c.lin([(0.35, bounce, 0), (1, bounce, rim_light)], 0, 0, 1, 1)
    edge += f'<path d="{rrect(x + 9, y + 15, w, h, r)}" fill="none" stroke="{under}" stroke-width="2"/>' if rim_light else ""
    return (
        f"{edge}"
        f'<path d="{outline}" fill="{face}"/>'
        f'<g clip-path="{clip}"><path d="{outline}" fill="{glow}"/>{dust}'
        f"{gloss(c, band, 0.06, 0, 0, 0.4, 1)}</g>"
        f'<path d="{rrect(x + 1, y + 1, w - 2, h - 2, r)}" fill="none" stroke="{rim}" stroke-width="2.4"/>',
        outline,
    )


def cord(points, color: str, light: str, width: float = 7) -> tuple[str, str]:
    """A braided cord through the given points (a smooth open curve): (shadow, body with a broken highlight)."""
    d = f"M{n(points[0][0])} {n(points[0][1])}" + "".join(
        f"Q{n(a[0])} {n(a[1])} {n((a[0] + b[0]) / 2)} {n((a[1] + b[1]) / 2)}" for a, b in zip(points[1:], points[2:])
    ) + f"L{n(points[-1][0])} {n(points[-1][1])}"
    return (
        f'<path d="{d}" fill="none" stroke="{INK}" stroke-opacity=".3" stroke-width="{n(width + 3)}" stroke-linecap="round" transform="translate(2 3)"/>',
        f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{n(width)}" stroke-linecap="round"/>'
        f'<path d="{d}" fill="none" stroke="{light}" stroke-width="{n(width * 0.3)}" stroke-linecap="round" stroke-dasharray="5 6" transform="translate(-1 -1.4)"/>',
    )


def seal_stamp(c: Canvas, x: float, y: float, size: float, ink: str) -> str:
    """The seal as a stamp impression in one ink: its own carving, nothing redrawn."""
    return carved_seal(x, y, size, ink)
