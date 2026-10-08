"""Scene 6 · Practice / Mainnet. Two states, two materials, two colours, each with a plate for its native label.
In front, Practice: paper money (a banded bundle of washi notes and one loose note, printed in the practice violet).
Apart and behind, Mainnet: real money, metal, in a lacquer tray lined in the mainnet blue. The tray and its blue carry
the mode; the koban and chōgin in it are only what "real" is made of (gold never means Mainnet). Nothing here shows a
switch: the art never implies the account's mode changes by itself."""
import math
import random

from keyart import seal_stamp
from kit import FIELD, INK, MAINNET, PAPER, PRACTICE, WHITE, Canvas, contact, embed, field, gloss, n, pts, rrect, shade, soft_ellipse

KEY = "scene-modes"
COLOR = FIELD["gray"]
SEED = 1606
NOTE_W, NOTE_H, NOTE_R = 440, 208, 7
BUNDLE_AT, BUNDLE_TILT, BUNDLE_SHEETS = (286, 606), -11, 9
LOOSE_AT, LOOSE_TILT = (214, 800), 6
TRAY_AT, TRAY_W, TRAY_H, TRAY_R, TRAY_WALL, TRAY_TILT = (548, 238), 318, 232, 48, 16, 7
KOBAN_AT, KOBAN_BOX = (-66, -2), 206  # tray coordinates
CHOGIN_AT, CHOGIN_BOX = (64, 22), 190
INKS = (PRACTICE["deep"], "#8B6BD6", PRACTICE["mid"])
FIBRES = 46
EDGE_TONES = ("#EFE7D3", "#E4DAC4")  # the bundle's page edges: two close paper tones, never a hard stripe
LABEL_H = 48
MAINNET_DEPTH, BUNDLE_DEPTH = 0.4, 0.8
MOTION = {"subject": "bundle", "mostMotion": ["note", "bundle"]}
LABELS = (
    ("practice", "bundle", "Practice · Test dollars", (452, 700), 284, PRACTICE["pale"], PRACTICE["deep"]),
    ("mainnet", "mainnet", "Real · USDC", (404, 376), 284, "#E8EBFF", MAINNET["deep"]),
)


def rosette(cx: float, cy: float, r: float, ink: str, petals: int = 14) -> str:
    """A guilloche rosette: overlapping ellipses turned around a centre."""
    return "".join(
        f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(r)}" ry="{n(r * 0.42)}" fill="none" stroke="{ink}" stroke-width="1.1" '
        f'transform="rotate({n(i * 180 / petals)} {n(cx)} {n(cy)})"/>'
        for i in range(petals)
    ) + f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r * 0.2)}" fill="{ink}"/>'


def wave(x0: float, x1: float, y: float, amp: float, period: float, phase: float) -> str:
    steps = int((x1 - x0) / 6)
    return "M" + "L".join(
        f"{n(x0 + (x1 - x0) * i / steps)} {n(y + amp * math.sin((x0 + (x1 - x0) * i / steps) / period * math.tau + phase))}"
        for i in range(steps + 1)
    )


def note(c: Canvas, rng: random.Random, edge: float = 1.0) -> tuple[str, str]:
    """One practice note, origin at its centre: washi, engraved violet frame, rosettes, the seal as its vignette.
    `edge` scales the sliver of thickness under it (a single loose sheet has almost none)."""
    w, h = NOTE_W, NOTE_H
    x, y = -w / 2, -h / 2
    outline = rrect(x, y, w, h, NOTE_R)
    paper = c.lin([(0, PAPER["light"]), (0.55, PAPER["mid"]), (1, "#EDE3CD")], 0, 0, 1, 1)
    wash = c.lin([(0, PRACTICE["pale"], 0.9), (0.5, PRACTICE["pale"], 0.5), (1, PRACTICE["pale"], 0.9)], 0, 0, 1, 0)
    crease = c.lin([(0, INK, 0), (0.3, INK, 0.07), (0.34, WHITE, 0.3), (0.4, INK, 0), (0.68, INK, 0.05), (0.7, WHITE, 0.2), (0.76, INK, 0)], 0, 0, 1, 0.12)
    clip = c.clip(f'<path d="{outline}"/>')
    ink, soft, pale = INKS
    fibres = "".join(
        f"M{n(fx)} {n(fy)}q{n(rng.uniform(-9, 9))} {n(rng.uniform(-5, 5))} {n(rng.uniform(-16, 16))} {n(rng.uniform(-8, 8))}"
        for fx, fy in ((rng.uniform(x, x + w), rng.uniform(y, y + h)) for _ in range(FIBRES))
    )
    waves = "".join(
        f'<path d="{wave(x + 30, x + w - 30, yy, 4.5, 26, ph)}" fill="none" stroke="{tone}" stroke-width="1.1"/>'
        for yy, ph, tone in ((y + 36, 0, soft), (y + 36, math.pi, pale), (y + h - 36, 0, soft), (y + h - 36, math.pi, pale))
    )
    oval = f'<ellipse rx="74" ry="66" fill="{PAPER["light"]}" stroke="{ink}" stroke-width="2.2"/><ellipse rx="66" ry="58" fill="none" stroke="{soft}" stroke-width="1"/>'
    return (
        f'<path d="{rrect(x + 1.4 * edge, y + 2.4 * edge, w, h, NOTE_R)}" fill="{PAPER["shade"]}"/>'
        f'<path d="{outline}" fill="{paper}"/>'
        f'<g clip-path="{clip}">'
        f'<rect x="{n(x + 20)}" y="{n(y + 20)}" width="{n(w - 40)}" height="{n(h - 40)}" fill="{wash}"/>'
        f'<path d="{fibres}" fill="none" stroke="{PAPER["shade"]}" stroke-opacity=".8" stroke-width=".9"/>'
        f'<path d="{rrect(x + 12, y + 12, w - 24, h - 24, 3)}" fill="none" stroke="{ink}" stroke-width="2.6"/>'
        f'<path d="{rrect(x + 19, y + 19, w - 38, h - 38, 2)}" fill="none" stroke="{soft}" stroke-width="1"/>'
        f"{waves}{rosette(-150, 0, 44, soft)}{rosette(150, 0, 44, soft)}"
        f'<circle cx="-150" cy="0" r="50" fill="none" stroke="{ink}" stroke-width="1.6"/>'
        f'<circle cx="150" cy="0" r="50" fill="none" stroke="{ink}" stroke-width="1.6"/>'
        f"{oval}{seal_stamp(c, -38, -38, 76, ink)}"
        f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" fill="{crease}"/></g>'
        f'<path d="{outline}" fill="none" stroke="{PAPER["shade"]}" stroke-width="1"/>',
        outline,
    )


def bundle(c: Canvas, rng: random.Random, sheet: str) -> str:
    """A banded stack of notes: sheet edges stepping to the lower right, the top note, a violet paper band."""
    w, h = NOTE_W, NOTE_H
    x, y = -w / 2, -h / 2
    edges = "".join(
        f'<path d="{rrect(x + k * 2.2 + rng.uniform(-0.9, 0.9), y + k * 3.4 + rng.uniform(-0.5, 0.5), w, h, NOTE_R)}" fill="{EDGE_TONES[k % 2]}" '
        f'transform="rotate({n(rng.uniform(-0.35, 0.35))})"/>'
        for k in range(BUNDLE_SHEETS, 0, -1)
    )
    band_w = 74
    band = c.lin([(0, PRACTICE["mid"]), (0.5, "#9A7BE6"), (1, PRACTICE["deep"])], 0, 0, 1, 1)
    drop = BUNDLE_SHEETS * 3.4
    return (
        f"{edges}{sheet}"
        f'<path d="{pts([(-band_w / 2, y - 2), (band_w / 2, y - 2), (band_w / 2 + drop * 0.65, y + h + drop), (-band_w / 2 + drop * 0.65, y + h + drop), (-band_w / 2, y + h)])}" fill="{PRACTICE["deep"]}"/>'
        f'<rect x="{n(-band_w / 2)}" y="{n(y - 2)}" width="{band_w}" height="{n(h + 2)}" fill="{band}"/>'
        f'<rect x="{n(-band_w / 2)}" y="{n(y - 2)}" width="3" height="{n(h + 2)}" fill="{WHITE}" fill-opacity=".35"/>'
        f"{seal_stamp(c, -24, -24, 48, PAPER['light'])}"
    )


def blue_tray(c: Canvas) -> tuple[str, str]:
    """The Mainnet object: a lacquer tray whose well is lined in the mainnet blue. Origin at its centre."""
    w, h, r, wall = TRAY_W, TRAY_H, TRAY_R, TRAY_WALL
    x, y = -w / 2, -h / 2
    outline = rrect(x, y, w, h, r)
    lip = c.lin([(0, "#5E4E67"), (0.35, "#3A2F42"), (1, "#1D1723")], 0, 0, 1, 1)
    lining = c.lin([(0, "#2530A8"), (0.6, "#2F3BC6"), (1, MAINNET["deep"])], 0, 0, 1, 1)
    rim = c.lin([(0, WHITE, 0.6), (0.4, WHITE, 0.04), (0.6, INK, 0.05), (1, INK, 0.55)], 0, 0, 1, 1)
    inner = rrect(x + wall, y + wall, w - 2 * wall, h - 2 * wall, r - wall)
    clip = c.clip(f'<path d="{inner}"/>')
    inner_rim = c.lin([(0, INK, 0.6), (0.45, INK, 0.05), (0.6, WHITE, 0.05), (1, WHITE, 0.5)], 0, 0, 1, 1)
    band = pts([(x + w * 0.36, y), (x + w * 0.52, y), (x + w * 0.3, y + h), (x + w * 0.14, y + h)])
    blue_line = c.lin([(0, MAINNET["mid"]), (1, MAINNET["deep"])], 0, 0, 1, 1)
    metals = (
        f'<g id="{KEY}-koban-shadow">{soft_ellipse(c, KOBAN_AT[0] + 6, KOBAN_AT[1] + 9, KOBAN_BOX * 0.3, KOBAN_BOX * 0.44, "#0B1066", 0.6, -12)}</g>'
        + f'<g id="{KEY}-koban">{embed(c, "brand/art/xau-koban.svg", KOBAN_AT[0] - KOBAN_BOX / 2, KOBAN_AT[1] - KOBAN_BOX / 2, KOBAN_BOX)}</g>'
        + f'<g id="{KEY}-chogin-shadow">{soft_ellipse(c, CHOGIN_AT[0] + 6, CHOGIN_AT[1] + 9, CHOGIN_BOX * 0.47, CHOGIN_BOX * 0.2, "#0B1066", 0.6, -32)}</g>'
        + f'<g id="{KEY}-chogin">{embed(c, "brand/art/xag-chogin.svg", CHOGIN_AT[0] - CHOGIN_BOX / 2, CHOGIN_AT[1] - CHOGIN_BOX / 2, CHOGIN_BOX)}</g>'
    )
    return (
        f'<path d="{rrect(x + 8, y + 13, w, h, r)}" fill="#0C0910"/>'
        f'<path d="{outline}" fill="{lip}"/>'
        f'<path d="{inner}" fill="{lining}"/>'
        f'<g clip-path="{clip}"><path d="{inner}" fill="none" stroke="#0B1066" stroke-opacity=".55" stroke-width="24" transform="translate(8 10)"/>'
        f"{gloss(c, band, 0.05, 0, 0, 0.4, 1)}</g>"
        f'<path d="{inner}" fill="none" stroke="{inner_rim}" stroke-width="2.4"/>'
        f'<path d="{rrect(x + wall * 0.5, y + wall * 0.5, w - wall, h - wall, r - wall * 0.5)}" fill="none" stroke="{blue_line}" stroke-width="2"/>'
        f'<path d="{rrect(x + 1, y + 1, w - 2, h - 2, r)}" fill="none" stroke="{rim}" stroke-width="2.2"/>{metals}',
        outline,
    )


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Practice and Mainnet: paper notes in front, metal money in a blue-lined tray apart (Senryo original)")
    rng = random.Random(SEED)
    field(c, COLOR)
    dark = shade(COLOR, 0.8)
    sheet, outline = note(c, rng)
    bundle_t = f"translate({BUNDLE_AT[0]} {BUNDLE_AT[1]}) rotate({BUNDLE_TILT})"
    loose_t = f"translate({LOOSE_AT[0]} {LOOSE_AT[1]}) rotate({LOOSE_TILT})"
    tray, tray_outline = blue_tray(c)
    tray_t = f"translate({TRAY_AT[0]} {TRAY_AT[1]}) rotate({TRAY_TILT})"
    # Practice in front travels most; Mainnet sits apart and behind. Each label plate rides in its own state's layer.
    c.put("mainnet-shadow", contact(tray_outline, dark, tray_t, 0.8), role="shadow", depth=MAINNET_DEPTH, of="mainnet")
    c.put("bundle-shadow", contact(outline, dark, bundle_t, 1.5), role="shadow", depth=BUNDLE_DEPTH, of="bundle")
    c.put("mainnet", f'<g transform="{tray_t}">{tray}</g>', depth=MAINNET_DEPTH)
    c.put("bundle", f'<g transform="{bundle_t}">{bundle(c, rng, sheet)}</g>', depth=BUNDLE_DEPTH)
    loose, _ = note(c, rng, 0.35)
    for name, layer, text, (x, y), width, plate, ink in LABELS:
        c.put(layer, c.label(name, layer, text, x, y, width, LABEL_H, plate, ink))
    c.put("note-shadow", contact(outline, dark, loose_t, 0.4), role="shadow", depth=BUNDLE_DEPTH, of="note")
    c.put("note", f'<g transform="{loose_t}">{loose}</g>', depth=1)
    return f"{KEY}.svg", c.svg()
