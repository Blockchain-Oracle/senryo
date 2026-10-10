"""Notification primer art: a gold fūrin (wind bell) hung from a short silk cord, seen from a little below the way one
hangs under the eaves, so its mouth opens as an ellipse onto the black lacquer inside. Its clapper is a holed gold
coin; below it the tanzaku, sumi-dyed washi dusted with gold, catches the breeze from the left. Transparent ground.

Layers (back to front): shadows · bell (cord, body, mouth: swings about the cord's loop) · ring (arcs of light off
its shoulders: they spread from the bell's waist as the clapper strikes) · tanzaku (its string and the paper: sways
most, about the coin's hole) · clapper (the coin: swings about where its string leaves the bell) · glints.
The static master is the Reduced Motion composition: caught mid-sway, nothing missing."""
import math
import random

from keyart import cord
from kit import FOIL, GOLD, INK, LACQUER, MAINNET, PRACTICE, WHITE, Canvas, mix, n, pts, rot, soft_path, sprinkle
from props import crinkles, glint, taper

KEY = "primer-notifications"
SIZE = 640
SEED = 1910
MOTION = {"subject": "bell", "mostMotion": ["tanzaku", "clapper"]}
HANG = (286, 52)  # the cord's loop: the bell swings about this point
BELL_TILT, CLAPPER_TILT, TANZAKU_TILT = -5.0, -11.0, -20.0  # the breeze from the left moves the paper most
CORD_LEN = 50  # loop to the bell's crown
MOUTH_R, BELL_H, SQUASH = 125, 198, 0.2  # mouth radius, crown to mouth, ellipse squash (seen ~12° from below)
TOP_R, SHOULDER_R, SHOULDER_AT, WAIST_GAIN, FLARE = 0.17, 0.72, 0.36, 0.07, 3.2  # the profile, as shares of the mouth radius
PROFILE_STEPS = 48
LIP_T, LIP_AT = 9, 0.88  # the rim's thickness, and where its raised bead starts (share of the height)
BAND = (0.47, 0.6)  # the black lacquer band round the waist (shares of the height)
CROWN_R = 11  # the gold loop on the crown the cord is tied through
COIN_R, COIN_HOLE, COIN_THICK, COIN_DROP = 27, 11, 4.5, 226  # the clapper; its drop from the crown
STRING_LEN = 30  # coin to the tanzaku's eyelet
TANZAKU_W, TANZAKU_L, TANZAKU_BEND, TANZAKU_TWIST = 60, 226, -9.0, 38.0  # the paper: width, length, bend and twist (degrees)
TANZAKU_TOP, RIBBON_STEPS, EYELET_R = 14, 30, 6.6  # paper above the eyelet
HEM, DECKLE, DECKLE_STEPS, MOTTLES = 0.05, 0.022, 90, 9  # the folded head, the torn washi edge, soft mottling in the dye
DECKLE_FAR = 2.6  # the far edge was torn, not cut: rough enough to show at 132 pt
# Sumi-dyed washi, lit → deep: the mainnet greys sunk toward the lacquer, so the paper reads as dyed, not lit.
AI = (mix(MAINNET["mid"], LACQUER["light"], 0.3), mix(MAINNET["deep"], LACQUER["mid"], 0.36), mix(MAINNET["deep"], LACQUER["shadow"], 0.56), mix(MAINNET["deep"], LACQUER["shadow"], 0.68))
KIRIHAKU, DUST, FIBRES, LONG_FIBRES = 12, 460, 70, 8  # cut squares of gold leaf, grains of gold dust, fine and long fibres
KOZO = ((-0.25, 0.3, 0.2, 0.32), (0.3, 0.4, 0.16, -0.26))  # two kozo fibres strong enough to hold at 132 pt: u, v, length, drift
FOOT_TONE = mix(PRACTICE["mid"], LACQUER["light"], 0.35)  # the grey cloud at the foot, dulled as dyed paper is
HEAD_CLOUD, FOOT_CLOUD, CLOUD_RAG = (0, 0.24), (0.72, 1), 0.035  # the uchigumori clouds (shares of the length), their raggedness
SHADOW_AT = (12, 20)  # where the bell's shadow falls on the wall behind it
SEAMS, SEAM_ROWS, CRINKLES = (-62, -30, 2, 34, 66), (0.25, 0.76), 9  # kinpaku laid in sheets: seams round and across, creases
CRINKLE_OPACITY = 0.5  # creases half as strong as on flat leaf: on a bell they must never read as cracks
SEAM_BREAKS = "34 9 21 14 46 6 17 11"  # a seam between sheets of leaf comes and goes; it is never a drawn line
# The ring: arcs of light off the bell's shoulders, as the clapper strikes (radius as a share of the mouth, from, to).
RING = ((1.24, -64, -26, 6), (1.5, -58, -32, 4.6), (1.24, 206, 238, 4.6))
TINT = MAINNET["pale"]  # the light the gold picks up: a pale grey, as on the pending-passkey art
# The gold turning round the bell, left edge → right edge: a reflected edge, the lamp's streak, the body, the far side.
TURN = (
    (0, FOIL[1]), (0.06, FOIL[2]), (0.16, FOIL[3]), (0.24, FOIL[4]), (0.3, WHITE), (0.36, FOIL[4]), (0.46, FOIL[3]),
    (0.58, FOIL[2]), (0.72, FOIL[1]), (0.84, FOIL[0]), (0.92, mix(FOIL[0], INK, 0.38)), (0.97, FOIL[0]), (1, FOIL[1]),
)  # fmt: skip


def radius(t: float) -> float:
    """The bell's profile: its radius at a share t of the height, crown (0) to mouth (1). A flat crown that rounds over
    the shoulder, an almost straight waist, and a flare into the mouth."""
    if t < SHOULDER_AT:
        x = t / SHOULDER_AT
        return MOUTH_R * (TOP_R + (SHOULDER_R - TOP_R) * math.sqrt(1 - (1 - x) ** 2))
    x = (t - SHOULDER_AT) / (1 - SHOULDER_AT)
    return MOUTH_R * (SHOULDER_R + WAIST_GAIN * x + (1 - SHOULDER_R - WAIST_GAIN) * x**FLARE)


def side(t0: float = 0.0, t1: float = 1.0, sign: float = 1.0) -> list[tuple[float, float]]:
    return [(sign * radius(t0 + (t1 - t0) * k / PROFILE_STEPS), (t0 + (t1 - t0) * k / PROFILE_STEPS) * BELL_H) for k in range(PROFILE_STEPS + 1)]


def near(t: float, r_scale: float = 1.0) -> str:
    """The near half of the bell's cross-section at t, right to left: seen from below it arches upward."""
    r, y = radius(t) * r_scale, t * BELL_H
    return f"M{n(r)} {n(y)}A{n(r)} {n(r * SQUASH)} 0 0 0 {n(-r)} {n(y)}"


def line(points) -> str:
    return "L".join(f"{n(x)} {n(y)}" for x, y in points)


def body_outline() -> str:
    """The outside of the bell down to the near lip (the mouth below it is drawn on its own)."""
    right, left = side(), side(sign=-1)[::-1]
    return f"M{line(right)}A{n(MOUTH_R)} {n(MOUTH_R * SQUASH)} 0 0 0 {n(-MOUTH_R)} {n(BELL_H)}L{line(left)}Z"


def silhouette() -> str:
    """The whole bell, mouth included: for its shadow."""
    right, left = side(), side(sign=-1)[::-1]
    return f"M{line(right)}A{n(MOUTH_R)} {n(MOUTH_R * SQUASH)} 0 0 1 {n(-MOUTH_R)} {n(BELL_H)}L{line(left)}Z"


def leaf_seams(rng: random.Random) -> str:
    """The bell is laid in kinpaku: faint seams where the sheets meet, running round it and down it (each follows the
    surface, so it bows as the rings do), and a few of the creases beaten leaf keeps."""
    down = [
        "M" + line((radius(t) * math.sin(math.radians(a)), t * BELL_H - radius(t) * math.cos(math.radians(a)) * SQUASH) for t in (0.05 + 0.9 * k / 20 for k in range(21)))
        for a in SEAMS
    ]
    seams = "".join(down) + "".join(near(t) for t in SEAM_ROWS)
    creases = crinkles(rng, MOUTH_R * 1.6, BELL_H * 0.8, CRINKLES)
    return (
        f'<path d="{seams}" fill="none" stroke="{GOLD["shadow"]}" stroke-opacity=".16" stroke-width=".9" stroke-dasharray="{SEAM_BREAKS}"/>'
        f'<path d="{seams}" fill="none" stroke="{WHITE}" stroke-opacity=".1" stroke-width=".8" stroke-dasharray="{SEAM_BREAKS}" transform="translate(.9 .9)"/>'
        f'<g transform="translate({n(-MOUTH_R * 0.8)} {n(BELL_H * 0.08)})" opacity="{CRINKLE_OPACITY}">{creases}</g>'
    )


def ring(c: Canvas) -> str:
    """Arcs of light thrown off the bell's shoulders when the clapper strikes: drawn out to nothing at both ends."""
    cx, cy = RING_AT
    out = ""
    for k, a0, a1, w in RING:
        points = [(cx + MOUTH_R * k * math.cos(math.radians(a + BELL_TILT)), cy + MOUTH_R * k * math.sin(math.radians(a + BELL_TILT))) for a in (a0 + (a1 - a0) * j / 16 for j in range(17))]
        out += f'<path d="{taper(points, w)}" fill="{GOLD["mid"]}" fill-opacity=".8"/><path d="{taper(points[3:-3], w * 0.36)}" fill="{GOLD["light"]}" fill-opacity=".85"/>'
    return out


def band(c: Canvas, rng: random.Random) -> str:
    """A band of black lacquer round the waist, gold dust sown into it, a gold bead along each edge."""
    t0, t1 = BAND
    r0, r1 = radius(t0), radius(t1)
    y0, y1 = t0 * BELL_H, t1 * BELL_H
    d = (
        f"M{line(side(t0, t1))}A{n(r1)} {n(r1 * SQUASH)} 0 0 0 {n(-r1)} {n(y1)}L{line(side(t0, t1, -1)[::-1])}"
        f"A{n(r0)} {n(r0 * SQUASH)} 0 0 1 {n(r0)} {n(y0)}Z"
    )
    turn = c.lin([(0, "#343434"), (0.14, "#6A5A73"), (0.24, "#383838"), (0.5, LACQUER["mid"]), (0.84, LACQUER["shadow"]), (0.95, "#101010"), (1, "#252525")], 0, 0, 1, 0)
    clip = c.clip(f'<path d="{d}"/>')
    dust = sprinkle(rng, 260, (-r1, y0 - r0 * SQUASH, r1, y1), GOLD["mid"], (0.5, 1.3), lambda x, y: 0.25 + 0.75 * ((x + r1) / (2 * r1)) ** 1.6)
    bead = c.lin([(0, GOLD["shadow"]), (0.2, GOLD["light"]), (0.5, GOLD["mid"]), (1, GOLD["shadow"])], 0, 0, 1, 0)
    return (
        f'<path d="{d}" fill="{turn}"/><g clip-path="{clip}">{dust}'
        f'<path d="{near(t0)}" fill="none" stroke="{INK}" stroke-opacity=".45" stroke-width="7" transform="translate(0 4)"/></g>'
        + "".join(
            f'<path d="{near(t)}" fill="none" stroke="{GOLD["shadow"]}" stroke-width="5" transform="translate(0 1.6)"/>'
            f'<path d="{near(t)}" fill="none" stroke="{bead}" stroke-width="3.6"/>'
            f'<path d="{near(t)}" fill="none" stroke="{WHITE}" stroke-opacity=".5" stroke-width="1" transform="translate(0 -1)"/>'
            for t in BAND
        )
    )


def bell(c: Canvas, rng: random.Random) -> str:
    """The bell in its own frame: crown at the origin, axis down +y, lit from the upper left."""
    outline = body_outline()
    clip = c.clip(f'<path d="{outline}"/>')
    turn = c.lin(list(TURN), 0, 0, 1, 0)
    top_light = c.lin([(0, WHITE, 0.34), (0.3, WHITE, 0.06), (0.55, WHITE, 0), (0.8, INK, 0), (1, INK, 0.2)], 0, 0, 0, 1)
    bloom = c.rad([(0, WHITE, 0.85), (0.35, WHITE, 0.3), (1, WHITE, 0)])
    bounce = c.lin([(0, TINT, 0), (0.8, TINT, 0), (1, TINT, 0.3)], 0, 0, 1, 0)
    streak = pts([(x * 0.62, y) for x, y in side(0.16, 0.86, -1)] + [(x * 0.5, y) for x, y in side(0.16, 0.86, -1)][::-1])
    streak_paint = c.lin([(0, WHITE, 0), (0.25, WHITE, 0.75), (0.75, WHITE, 0.5), (1, WHITE, 0)], 0, 0, 0, 1)
    rim = c.lin([(0, GOLD["light"]), (0.3, FOIL[3]), (0.7, FOIL[1]), (1, FOIL[0])], 0, 0, 1, 0)
    ri = MOUTH_R - LIP_T
    inside = c.rad([(0, "#333333"), (0.45, LACQUER["mid"]), (1, "#080808")], 0.42, 0.95, 0.75)
    inside_clip = c.clip(f'<ellipse cy="{n(BELL_H)}" rx="{n(ri)}" ry="{n(ri * SQUASH)}"/>')
    far_glow = c.lin([(0.5, GOLD["mid"], 0), (1, GOLD["mid"], 0.4)], 0, 0, 0, 1)
    dust = sprinkle(rng, 90, (-ri, BELL_H - ri * SQUASH, ri, BELL_H + ri * SQUASH), GOLD["mid"], (0.5, 1.2), lambda x, y: (y - BELL_H + ri * SQUASH) / (2 * ri * SQUASH))
    crown = c.lin([(0, GOLD["light"]), (0.5, GOLD["mid"]), (1, GOLD["shadow"])], 0, 0, 1, 1)
    bead_paint = c.lin([(0, FOIL[1]), (0.2, GOLD["light"]), (0.34, FOIL[3]), (0.7, FOIL[1]), (1, FOIL[0])], 0, 0, 1, 0)
    return (
        # the crown's loop, behind the body where it is soldered on
        f'<circle cy="{n(-CROWN_R + 2)}" r="{CROWN_R}" fill="none" stroke="{GOLD["shadow"]}" stroke-width="7.5" transform="translate(1.4 1.8)"/>'
        f'<circle cy="{n(-CROWN_R + 2)}" r="{CROWN_R}" fill="none" stroke="{crown}" stroke-width="6"/>'
        # the mouth: the rim's underside, then the lacquered inside
        f'<ellipse cy="{n(BELL_H)}" rx="{n(MOUTH_R)}" ry="{n(MOUTH_R * SQUASH)}" fill="{rim}"/>'
        f'<ellipse cy="{n(BELL_H + 0.8)}" rx="{n(ri)}" ry="{n(ri * SQUASH)}" fill="{inside}"/>'
        f'<g clip-path="{inside_clip}"><ellipse cy="{n(BELL_H)}" rx="{n(ri)}" ry="{n(ri * SQUASH)}" fill="{far_glow}" opacity=".6"/>{dust}'
        f'<path d="{near(1, ri / MOUTH_R)}" fill="none" stroke="{INK}" stroke-opacity=".55" stroke-width="8" transform="translate(0 3)"/></g>'
        # the body
        f'<path d="{outline}" fill="{turn}"/>'
        f'<g clip-path="{clip}"><path d="{outline}" fill="{top_light}"/><path d="{outline}" fill="{bounce}"/>'
        f'<path d="{streak}" fill="{streak_paint}"/>'
        f'<ellipse cx="{n(-MOUTH_R * 0.42)}" cy="{n(BELL_H * 0.2)}" rx="{n(MOUTH_R * 0.34)}" ry="{n(BELL_H * 0.14)}" fill="{bloom}" transform="rotate(-30 {n(-MOUTH_R * 0.42)} {n(BELL_H * 0.2)})"/>'
        f"{leaf_seams(rng)}{band(c, rng)}"
        f'<path d="{near(LIP_AT)}" fill="none" stroke="{FOIL[0]}" stroke-opacity=".7" stroke-width="2.6" transform="translate(0 -2)"/>'
        f'<path d="{near(LIP_AT)}" fill="none" stroke="{bead_paint}" stroke-width="2.6" transform="translate(0 .8)"/>'
        f'<path d="{near(1)}" fill="none" stroke="{GOLD["light"]}" stroke-opacity=".9" stroke-width="2"/></g>'
        f'<path d="{outline}" fill="none" stroke="{FOIL[0]}" stroke-opacity=".55" stroke-width="1.2"/>'
        f'<ellipse cy="{n(BELL_H)}" rx="{n(MOUTH_R)}" ry="{n(MOUTH_R * SQUASH)}" fill="none" stroke="{FOIL[0]}" stroke-opacity=".5" stroke-width="1.2"/>'
    )


def frame_point(p, tilt: float, origin) -> tuple[float, float]:
    x, y = rot(p, tilt)
    return origin[0] + x, origin[1] + y


def bell_point(p) -> tuple[float, float]:
    """A point in the bell's own frame, on the canvas."""
    return frame_point((p[0], p[1] + CORD_LEN), BELL_TILT, HANG)


def coin(c: Canvas) -> tuple[str, str]:
    """The clapper: a round gold coin with a square hole, face on, its edge falling to the lower right. Returns
    (markup, outline) centred on the hole."""
    r, h = COIN_R, COIN_HOLE / 2
    hole = f"M{n(-h)} {n(-h)}H{n(h)}V{n(h)}H{n(-h)}Z"
    disc = f"M{-r} 0a{r} {r} 0 1 0 {2 * r} 0a{r} {r} 0 1 0 {-2 * r} 0Z"
    outline = disc + hole
    face = c.lin([(0, GOLD["light"]), (0.3, FOIL[3]), (0.62, GOLD["mid"]), (1, FOIL[1])], 0, 0, 1, 1)
    ring = c.lin([(0, WHITE, 0.9), (0.45, GOLD["light"], 0.2), (0.6, FOIL[0], 0.3), (1, FOIL[0], 0.9)], 0, 0, 1, 1)
    edge = "".join(
        f'<path d="{outline}" fill-rule="evenodd" fill="{tone}" transform="translate({n(COIN_THICK * 0.6 * k)} {n(COIN_THICK * k)})"/>'
        for k, tone in ((1, FOIL[0]), (0.5, FOIL[1]))
    )
    inner = r * 0.7
    return (
        f"{edge}"
        f'<path d="{outline}" fill-rule="evenodd" fill="{face}"/>'
        f'<circle r="{n(r - 1.2)}" fill="none" stroke="{ring}" stroke-width="2.4"/>'
        f'<circle r="{n(inner)}" fill="none" stroke="{FOIL[0]}" stroke-opacity=".55" stroke-width="1.4" transform="translate(.6 .9)"/>'
        f'<circle r="{n(inner)}" fill="none" stroke="{GOLD["light"]}" stroke-opacity=".8" stroke-width="1"/>'
        f'<path d="M{n(-h)} {n(h)}V{n(-h)}H{n(h)}" fill="none" stroke="{FOIL[0]}" stroke-width="2"/>'
        f'<path d="M{n(h)} {n(-h)}V{n(h)}H{n(-h)}" fill="none" stroke="{GOLD["light"]}" stroke-width="1.6"/>',
        outline,
    )


def ribbon(top, tilt: float):
    """The tanzaku's surface: a strip hanging from `top` at `tilt`, bending further with the breeze and twisting as
    it goes, so it narrows toward its foot. Returns f(u, v) → canvas point (u ∈ [-1, 1] across, v ∈ [0, 1] down)."""
    centre, x, y = [], *top
    for k in range(RIBBON_STEPS + 1):
        v = k / RIBBON_STEPS
        a = math.radians(tilt + TANZAKU_BEND * v**2)
        centre.append((x, y, a, math.cos(math.radians(TANZAKU_TWIST * v**1.4))))
        x, y = x - math.sin(a) * TANZAKU_L / RIBBON_STEPS, y + math.cos(a) * TANZAKU_L / RIBBON_STEPS

    def at(u: float, v: float) -> tuple[float, float]:
        k = min(v, 1.0) * RIBBON_STEPS
        i = min(int(k), RIBBON_STEPS - 1)
        f = k - i
        (x0, y0, a0, w0), (x1, y1, a1, w1) = centre[i], centre[i + 1]
        cx, cy, a, w = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, a0 + (a1 - a0) * f, w0 + (w1 - w0) * f
        return cx + math.cos(a) * u * w * TANZAKU_W / 2, cy + math.sin(a) * u * w * TANZAKU_W / 2

    return at


def tanzaku(c: Canvas, rng: random.Random, top) -> tuple[str, str]:
    """Uchigumori washi: sumi-dyed paper clouded lighter at the head and grey at the foot, its fibres showing, gold dust
    and a few cut squares of leaf sown into both clouds; an eyelet near the top. Returns (markup, outline)."""
    at = ribbon(top, TANZAKU_TILT)

    def deckle() -> list[float]:
        """Washi tears rather than cuts: a slow wander with a little grit, in shares of the half-width."""
        waves = [(rng.uniform(0.3, 0.6), rng.uniform(9, 23), rng.uniform(0, math.tau)) for _ in range(3)]
        return [DECKLE * (sum(a * math.sin(f * math.tau * k / DECKLE_STEPS + ph) for a, f, ph in waves) + rng.uniform(-0.7, 0.7)) for k in range(DECKLE_STEPS + 1)]

    left, right, foot = deckle(), deckle(), deckle()
    along = [k / DECKLE_STEPS for k in range(DECKLE_STEPS + 1)]
    edge_l = [at(-1 - left[k], v) for k, v in enumerate(along)]
    edge_r = [at(1 + right[k] * DECKLE_FAR, v) for k, v in enumerate(along)]
    edge_f = [at(1 - 2 * k / DECKLE_STEPS, 1 + foot[k] * 0.12) for k in range(DECKLE_STEPS + 1)]
    outline = pts(edge_l + edge_f[::-1] + edge_r[::-1])
    paper = c.lin([(0, AI[0]), (0.3, AI[1]), (0.8, AI[2]), (1, AI[3])], *at(0, 0), *at(0, 1), user=True)
    across = c.lin([(0, WHITE, 0.08), (0.35, WHITE, 0.01), (0.7, INK, 0), (1, INK, 0.16)], *at(-1, 0.3), *at(1, 0.3), user=True)
    clip = c.clip(f'<path d="{outline}"/>')
    clouds = ""
    for (v0, v1), tone, alpha in ((HEAD_CLOUD, MAINNET["pale"], 0.34), (FOOT_CLOUD, FOOT_TONE, 0.3)):
        head = v0 == 0
        edge, end, inward = (v1, 0, -1) if head else (v0, 1.02, 1)  # the ragged edge faces the middle of the strip
        phase = rng.uniform(0, math.tau)
        for inset, k in ((0, 0.5), (CLOUD_RAG, 1.0)):  # a soft fringe, then the body of the cloud a little inside it
            rag = [(u, edge + inward * inset + CLOUD_RAG * (math.sin(u * 4.1 + phase) + 0.5 * math.sin(u * 9.3 + phase * 2))) for u in (j / 10 - 1 for j in range(21))]
            clouds += f'<path d="{pts(at(u, v) for u, v in [(-1.1, end), *rag, (1.1, end)])}" fill="{tone}" fill-opacity="{n(alpha * k)}"/>'
    fibres, long_fibres = [], []
    for i in range(FIBRES + LONG_FIBRES):
        long = i >= FIBRES  # a few kozo fibres long enough to show through the dye
        u, v, length = rng.uniform(-0.85, 0.85), rng.uniform(0.05, 0.9), rng.uniform(0.14, 0.24) if long else rng.uniform(0.03, 0.08)
        drift = rng.uniform(-0.3, 0.3) if long else rng.uniform(-0.12, 0.12)
        (long_fibres if long else fibres).append("M" + line(at(u + drift * math.sin(k / 8 * math.pi), v + length * k / 8) for k in range(9)))
    kozo = "".join("M" + line(at(u + drift * math.sin(k / 8 * math.pi), v + length * k / 8) for k in range(9)) for u, v, length, drift in KOZO)
    dust = []
    for _ in range(DUST):
        v = rng.random()
        keep = max(1 - v / HEAD_CLOUD[1], (v - FOOT_CLOUD[0]) / (1 - FOOT_CLOUD[0]), 0) ** 1.4
        if rng.random() < keep:
            x, y = at(rng.uniform(-1, 1), v)
            r = rng.uniform(0.5, 1.4)
            dust.append(f"M{n(x - r)} {n(y)}a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0Z")
    sown = "".join(f'<path d="{"".join(dust[i::3])}" fill="{GOLD["mid"]}" fill-opacity="{a}"/>' for i, a in enumerate((".45", ".7", ".95")))
    leaf = c.lin([(0, GOLD["light"]), (0.5, GOLD["mid"]), (1, GOLD["shadow"])], 0, 0, 1, 1)
    squares = []
    aspect = TANZAKU_W / TANZAKU_L / 2
    for _ in range(KIRIHAKU):
        v = rng.choice((rng.uniform(0.07, HEAD_CLOUD[1] + 0.04), rng.uniform(FOOT_CLOUD[0] - 0.04, 0.95)))
        u, s, a = rng.uniform(-0.75, 0.75), rng.uniform(0.07, 0.13), rng.uniform(0, 90)
        squares.append(pts(at(u + s * math.cos(math.radians(a + 90 * i)), v + s * aspect * math.sin(math.radians(a + 90 * i))) for i in range(4)))
    mottle_light = c.rad([(0, WHITE, 0.05), (1, WHITE, 0)])
    mottle_dark = c.rad([(0, INK, 0.06), (1, INK, 0)])
    mottles = ""
    for i in range(MOTTLES):  # the dye takes unevenly: soft patches a little lighter or deeper
        u, v = rng.uniform(-0.6, 0.6), rng.uniform(0.15, 0.85)
        x, y = at(u, v)
        a = TANZAKU_TILT + TANZAKU_BEND * v**2
        mottles += f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="{n(TANZAKU_W * rng.uniform(0.25, 0.45))}" ry="{n(rng.uniform(8, 18))}" fill="{mottle_light if i % 2 else mottle_dark}" transform="rotate({n(a)} {n(x)} {n(y)})"/>'
    hem = pts([*(at(u / 10 - 1.1, 0) for u in range(23)), *(at(1.1 - u / 10, HEM) for u in range(23))])
    fold = "M" + line(at(u / 10 - 1, HEM) for u in range(21))
    eyelet = at(0, TANZAKU_TOP / TANZAKU_L)
    return (
        f'<path d="{outline}" fill="{paper}"/>'
        f'<g clip-path="{clip}">{mottles}{clouds}<path d="{outline}" fill="{across}"/>'
        f'<path d="{"".join(fibres)}" fill="none" stroke="{MAINNET["pale"]}" stroke-opacity=".1" stroke-width=".7" stroke-linecap="round"/>'
        f'<path d="{"".join(long_fibres)}" fill="none" stroke="{MAINNET["pale"]}" stroke-opacity=".16" stroke-width="1.3" stroke-linecap="round"/>'
        f'<path d="{kozo}" fill="none" stroke="{mix(MAINNET["pale"], WHITE, 0.4)}" stroke-opacity=".32" stroke-width="1.8" stroke-linecap="round"/>{sown}'
        f'<path d="{"".join(squares)}" fill="{leaf}"/>'
        f'<path d="{hem}" fill="{AI[3]}" fill-opacity=".3"/>'
        f'<path d="{fold}" fill="none" stroke="{INK}" stroke-opacity=".25" stroke-width="1.4" transform="translate(0 1.2)"/>'
        f'<path d="{fold}" fill="none" stroke="{WHITE}" stroke-opacity=".3" stroke-width="1"/></g>'
        f'<path d="M{line(edge_l)}M{line(at(u / 10 - 1, 0) for u in range(21))}" fill="none" stroke="{WHITE}" stroke-opacity=".22" stroke-width="1.1"/>'
        f'<path d="M{line(edge_f[::-1] + edge_r[::-1])}" fill="none" stroke="{AI[3]}" stroke-opacity=".7" stroke-width="1.1"/>'
        f'<circle cx="{n(eyelet[0])}" cy="{n(eyelet[1])}" r="{EYELET_R}" fill="{LACQUER["shadow"]}"/>'
        f'<circle cx="{n(eyelet[0])}" cy="{n(eyelet[1])}" r="{EYELET_R}" fill="none" stroke="{GOLD["mid"]}" stroke-width="2.6"/>'
        f'<circle cx="{n(eyelet[0])}" cy="{n(eyelet[1])}" r="{n(EYELET_R + 1.2)}" fill="none" stroke="{GOLD["light"]}" stroke-opacity=".6" stroke-width=".8" transform="translate(-.6 -.8)"/>',
        outline,
    )


RIM_IN = MOUTH_R - LIP_T
LEAVE = bell_point((0, BELL_H - RIM_IN * SQUASH + 1.5))  # where the clapper's string comes out past the near lip
HOLE = frame_point((0, COIN_DROP), CLAPPER_TILT, bell_point((0, 0)))  # the coin's hole: the tanzaku sways about it
EYELET = frame_point((0, COIN_R + STRING_LEN), TANZAKU_TILT, HOLE)
RING_AT = bell_point((0, BELL_H * 0.42))  # the arcs of the ring spread from here
PIVOTS = {"bell": HANG, "clapper": LEAVE, "tanzaku": HOLE, "ring": RING_AT}  # in master units, for layers.json


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Notification primer: a gold fūrin with its tanzaku in the breeze (Senryo original)", SIZE, SIZE)
    rng = random.Random(SEED)
    bell_t = f"translate({HANG[0]} {HANG[1]}) rotate({BELL_TILT}) translate(0 {CORD_LEN})"
    top = frame_point((0, -TANZAKU_TOP), TANZAKU_TILT, EYELET)
    coin_markup, coin_outline = coin(c)
    paper, paper_outline = tanzaku(c, rng, top)
    loop = [(0, 16), (-11, 6), (-13, -8), (-6, -17), (6, -17), (13, -8), (11, 6), (0, 16), (0, CORD_LEN - CROWN_R * 2 + 4)]
    loop_shadow, loop_body = cord([rot(p, BELL_TILT) for p in loop], PRACTICE["deep"], PRACTICE["mid"], 6)
    string_shadow, string_body = cord([HOLE, EYELET], PRACTICE["deep"], PRACTICE["mid"], 3)
    _, clapper_string = cord([LEAVE, (HOLE[0], HOLE[1] - COIN_HOLE / 2)], PRACTICE["deep"], PRACTICE["mid"], 3)
    c.put("bell-shadow", soft_path(silhouette(), 26, LACQUER["shadow"], 0.14, transform=f"translate({SHADOW_AT[0]} {SHADOW_AT[1]}) {bell_t}"), role="shadow", depth=0.6, of="bell")
    c.put("tanzaku-shadow", soft_path(paper_outline, 22, LACQUER["shadow"], 0.09, transform=f"translate({SHADOW_AT[0] - 6} {SHADOW_AT[1] - 8})"), role="shadow", depth=0.6, of="tanzaku")
    c.put("clapper-shadow", soft_path(coin_outline, 8, LACQUER["shadow"], 0.12, transform=f"translate({n(HOLE[0] + 12)} {n(HOLE[1] + 18)})"), role="shadow", depth=0.6, of="clapper")
    c.put("bell", f'<g transform="translate({HANG[0]} {HANG[1]})">{loop_shadow}{loop_body}</g>', f'<g transform="{bell_t}">{bell(c, rng)}</g>', depth=0.6)
    c.put("ring", ring(c), role="accent", depth=0.6)
    c.put("tanzaku", string_shadow, string_body, paper, depth=1)
    c.put("clapper", clapper_string, f'<g transform="translate({n(HOLE[0])} {n(HOLE[1])}) rotate({CLAPPER_TILT})">{coin_markup}</g>', depth=1)
    c.put("glints", glint(528, 120, 24, GOLD["mid"]) + glint(112, 318, 14, TINT, 10) + glint(498, 474, 10, GOLD["mid"]), role="accent", depth=0.4)
    return f"{KEY}.svg", c.svg()
