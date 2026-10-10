"""Shared kit for the authored J1 artwork (S1b.3): onboarding scenes, pending-passkey art, completion foil, avatars.

- Canvas collects defs and named top-level layers (`<key>-field`, `-back`, `-shadow`, `-main`, `-fore`) so each layer can
  later be driven on its own with Skia/Reanimated. No <text>, no <filter>, no <style>: gradients, clip paths, masks and
  opacity only, exactly like art.py, so react-native-svg and Skia draw the masters as authored.
- Soft shadows are stacked translucent shapes or radial gradients (a filter would not survive react-native-svg).
- Light comes from the upper left on every object; thickness always falls to the lower right (same as art.py).
- Colours: the material ramps (`MATERIAL` in packages/tokens), the UGLYCASH practice/mainnet roles (`palette.ts`) and
  the six scene fields (`SCENE_FIELD`).
"""
import math
import os
import random
import re

from art import BRAND, GLYPH, GOLD, INK, LACQUER, ROOT, SILVER  # noqa: F401  (the ramps are re-exported to the scenes)

SCENE_W, SCENE_H = 756, 940  # the 378 × 470 pt hero at 2x
ART = os.path.join(BRAND, "art")
FIELD = {
    "yellow": "#FAF543",
    "periwinkle": "#7690ED",
    "lime": "#C4DA78",
    "pink": "#F58CE1",
    "orange": "#F1803A",
    "gray": "#B7BBC6",
}
WHITE = "#FFFFFF"
FOIL = (GOLD["shadow"], "#AE8941", GOLD["mid"], "#EACF8C", GOLD["light"])  # KINPAKU foil stops, deep → highlight
PRACTICE = {"deep": "#666666", "mid": "#B8B8B8", "pale": "#ECECEC"}  # LIGHT.practice, DARK.practice, LIGHT.practiceSurface
MAINNET = {"deep": "#000000", "mid": "#363636", "pale": "#E2E2E2"}  # LIGHT.mainnet, DARK.mainnetSurface, LIGHT.mainnetSurface
PAPER = {"light": "#FFFDF6", "mid": "#F6EFDF", "shade": "#D9CFBA"}
SHADOW_INK = LACQUER["shadow"]
# What each field's shadow deepens toward: its own hue, darker (a multiplied shadow), never a neutral grey.
FIELD_DEPTH = {
    "#FAF543": "#5E4A00",
    "#7690ED": "#161A5E",
    "#C4DA78": "#2A3F0C",
    "#F58CE1": "#5A124E",
    "#F1803A": "#561A06",
    "#B7BBC6": "#272A3A",
}
SHADOW_STEPS = 16
# Label anchors recorded by Canvas.label(), by master key: onboarding.py writes them to labels.json for the app.
LABELS: dict[str, list[dict]] = {}
# Layer lists recorded by Canvas.svg(), by master key: onboarding.py writes them to layers.json for the app.
MANIFEST: dict[str, list[dict]] = {}


def n(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


def rgb(h: str) -> tuple[int, int, int]:
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def mix(a: str, b: str, t: float) -> str:
    """a → b by t in sRGB."""
    ca, cb = rgb(a), rgb(b)
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(ca, cb))


def ramp(stops: tuple[str, ...], t: float) -> str:
    """Samples an evenly spaced colour ramp at t ∈ [0, 1]."""
    t = min(max(t, 0.0), 1.0) * (len(stops) - 1)
    i = min(int(t), len(stops) - 2)
    return mix(stops[i], stops[i + 1], t - i)


def shade(field: str, depth: float = 0.5) -> str:
    """The colour a shadow takes on a scene field: the field pulled toward its own deep tone."""
    return mix(field, FIELD_DEPTH.get(field, SHADOW_INK), depth)


def pts(points) -> str:
    return "M" + "L".join(f"{n(x)} {n(y)}" for x, y in points) + "Z"


def rrect(x: float, y: float, w: float, h: float, r: float) -> str:
    return (
        f"M{n(x + r)} {n(y)}H{n(x + w - r)}A{n(r)} {n(r)} 0 0 1 {n(x + w)} {n(y + r)}V{n(y + h - r)}"
        f"A{n(r)} {n(r)} 0 0 1 {n(x + w - r)} {n(y + h)}H{n(x + r)}A{n(r)} {n(r)} 0 0 1 {n(x)} {n(y + h - r)}"
        f"V{n(y + r)}A{n(r)} {n(r)} 0 0 1 {n(x + r)} {n(y)}Z"
    )


def dot(x: float, y: float, r: float) -> str:
    return f"M{n(x - r)} {n(y)}a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0Z"


def rot(p, deg: float, c=(0.0, 0.0)):
    a = math.radians(deg)
    x, y = p[0] - c[0], p[1] - c[1]
    return c[0] + x * math.cos(a) - y * math.sin(a), c[1] + x * math.sin(a) + y * math.cos(a)


class Canvas:
    """One SVG master: defs plus ordered, named top-level layers. A layer is one unit of motion: the field, one object,
    or one object's shadow. Each records its role (field, shadow, ground, object, accent), the object a shadow belongs
    to, and a depth: how far it travels relative to the others (0 = still; equal depths move together)."""

    def __init__(self, key: str, title: str, w: float = SCENE_W, h: float = SCENE_H):
        self.key, self.title, self.w, self.h = key, title, w, h
        self.defs: list[str] = []
        self.layers: dict[str, list[str]] = {}
        self.roles: dict[str, dict] = {}
        self.labels: list[dict] = []
        self.count = 0

    def uid(self, hint: str) -> str:
        self.count += 1
        return f"{self.key}-{hint}{self.count}"

    def _stops(self, stops) -> str:
        return "".join(
            f'<stop offset="{n(o)}" stop-color="{c}"' + (f' stop-opacity="{n(a)}"' if a < 1 else "") + "/>"
            for o, c, a in ((*s, 1)[:3] for s in stops)
        )

    def lin(self, stops, x1=0.0, y1=0.0, x2=0.0, y2=1.0, user=False) -> str:
        pid = self.uid("l")
        u = ' gradientUnits="userSpaceOnUse"' if user else ""
        self.defs.append(
            f'<linearGradient id="{pid}" x1="{n(x1)}" y1="{n(y1)}" x2="{n(x2)}" y2="{n(y2)}"{u}>'
            f"{self._stops(stops)}</linearGradient>"
        )
        return f"url(#{pid})"

    def rad(self, stops, cx=0.5, cy=0.5, r=0.5, fx=None, fy=None, user=False, transform="") -> str:
        pid = self.uid("r")
        u = ' gradientUnits="userSpaceOnUse"' if user else ""
        f = f' fx="{n(fx)}" fy="{n(fy)}"' if fx is not None else ""
        t = f' gradientTransform="{transform}"' if transform else ""
        self.defs.append(
            f'<radialGradient id="{pid}" cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}"{f}{u}{t}>{self._stops(stops)}</radialGradient>'
        )
        return f"url(#{pid})"

    def clip(self, markup: str) -> str:
        pid = self.uid("c")
        self.defs.append(f'<clipPath id="{pid}">{markup}</clipPath>')
        return f"url(#{pid})"

    def mask(self, markup: str) -> str:
        pid = self.uid("m")
        self.defs.append(
            f'<mask id="{pid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{n(self.w)}" height="{n(self.h)}">{markup}</mask>'
        )
        return f"url(#{pid})"

    def label(self, name: str, layer: str, text: str, x: float, y: float, w: float, h: float, plate: str, ink: str) -> str:
        """A label plate the app fills with native text (never drawn into the master): returns the plate markup and
        records its anchor for labels.json: the box in master units, the text, its ink, and the layer the plate is
        drawn in (the native text must move with that layer)."""
        self.labels.append(
            {"id": f"{self.key}-label-{name}", "layer": f"{self.key}-{layer}", "text": text, "x": round(x, 1), "y": round(y, 1), "width": w, "height": h, "ink": ink}
        )
        LABELS[self.key] = self.labels
        return (
            f'<g id="{self.key}-label-{name}">'
            f'<rect x="{n(x + 2)}" y="{n(y + 4)}" width="{n(w)}" height="{n(h)}" rx="{n(h / 2)}" fill="{SHADOW_INK}" fill-opacity=".22"/>'
            f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" rx="{n(h / 2)}" fill="{plate}"/></g>'
        )

    def put(self, layer: str, *markup: str, role: str = "object", depth: float = 0.0, of: str = "") -> None:
        if layer not in self.layers:
            self.roles[layer] = {"id": f"{self.key}-{layer}", "role": role, "depth": depth} | ({"of": f"{self.key}-{of}"} if of else {})
        self.layers.setdefault(layer, []).extend(markup)

    def svg(self) -> str:
        groups = "\n  ".join(f'<g id="{self.key}-{name}">{"".join(body)}</g>' for name, body in self.layers.items())
        MANIFEST[self.key] = [self.roles[name] for name in self.layers]
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="0 0 {n(self.w)} {n(self.h)}" width="{n(self.w)}" height="{n(self.h)}">\n'
            f"  <title>{self.title}</title>\n  <defs>{''.join(self.defs)}</defs>\n  {groups}\n</svg>\n"
        )


# --- shadows --------------------------------------------------------------------------------------------------
def soft_ellipse(c: Canvas, cx, cy, rx, ry, color=SHADOW_INK, alpha=0.4, deg=0.0) -> str:
    """A blurred elliptical shadow: one radial gradient, dense core fading to nothing."""
    paint = c.rad([(0, color, alpha), (0.45, color, alpha * 0.72), (0.78, color, alpha * 0.22), (1, color, 0)])
    t = f' transform="rotate({n(deg)} {n(cx)} {n(cy)})"' if deg else ""
    return f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(rx)}" ry="{n(ry)}" fill="{paint}"{t}/>'


def ease_out(t: float) -> float:
    """Inverse smoothstep: where a smooth falloff reaches the level t."""
    return 0.5 - math.sin(math.asin(1 - 2 * t) / 3)


def soft_path(d: str, blur: float, color=SHADOW_INK, alpha=0.4, steps=SHADOW_STEPS, transform="", name="") -> str:
    """A blurred shadow of any closed path: the fill plus stacked round strokes. The stroke widths follow a smooth
    falloff (many faint layers, eased), so the edge has no visible steps."""
    each = 1 - (1 - alpha) ** (1 / (steps + 1))
    t = f' transform="{transform}"' if transform else ""
    i_d = f' id="{name}"' if name else ""
    out = [f'<g{i_d}{t} fill="{color}" stroke="{color}" stroke-linejoin="round">']
    for i in range(steps):
        width = blur * 2 * ease_out(1 - (i + 0.5) / steps)
        out.append(f'<path d="{d}" fill-opacity="{n(each)}" stroke-opacity="{n(each)}" stroke-width="{n(width)}"/>')
    out.append(f'<path d="{d}" fill-opacity="{n(each)}" stroke="none"/></g>')
    return "".join(out)


def contact(d: str, color: str, transform: str, lift: float = 1.0, name: str = "") -> str:
    """The house shadow under a resting object: a tight dark contact plus a short soft throw to the lower right.
    `lift` scales how far above the surface the object sits."""
    base = f"translate({n(4 * lift)} {n(7 * lift)}) {transform}"
    far = f"translate({n(12 * lift)} {n(18 * lift)}) {transform}"
    i_d = f' id="{name}"' if name else ""
    return f"<g{i_d}>{soft_path(d, 20 * lift, color, 0.2, transform=far)}{soft_path(d, 5 * lift, color, 0.4, 8, base)}</g>"


# --- materials ------------------------------------------------------------------------------------------------
def field(c: Canvas, color: str) -> None:
    """The scene's colour field: flat colour, a soft light bloom upper left, a deeper tone lower right."""
    glow = c.rad([(0, WHITE, 0.2), (0.6, WHITE, 0.04), (1, WHITE, 0)], 0.22, 0.16, 0.9)
    deep = c.rad([(0, shade(color, 0.55), 0), (0.55, shade(color, 0.55), 0.04), (1, shade(color, 0.55), 0.26)], 0.3, 0.2, 1.05)
    c.put(
        "field",
        f'<rect width="{n(c.w)}" height="{n(c.h)}" fill="{color}"/>',
        f'<rect width="{n(c.w)}" height="{n(c.h)}" fill="{glow}"/>',
        f'<rect width="{n(c.w)}" height="{n(c.h)}" fill="{deep}"/>',
        role="field",
    )


def sprinkle(rng: random.Random, count: int, box, color: str, r=(0.5, 1.5), falloff=None) -> str:
    """Nashiji: gold dust sown into lacquer. `falloff(x, y)` → keep probability; three opacity classes, three paths."""
    x0, y0, x1, y1 = box
    classes: list[list[str]] = [[], [], []]
    for _ in range(count):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if falloff and rng.random() > falloff(x, y):
            continue
        classes[rng.randrange(3)].append(dot(x, y, rng.uniform(*r)))
    return "".join(
        f'<path d="{"".join(ds)}" fill="{color}" fill-opacity="{n(a)}"/>' for ds, a in zip(classes, (0.35, 0.6, 0.9)) if ds
    )


def gloss(c: Canvas, d: str, alpha=0.2, x1=0.0, y1=0.0, x2=1.0, y2=1.0, color=WHITE) -> str:
    """A lacquer reflection: a shape filled with light that fades along its own axis."""
    paint = c.lin([(0, color, alpha), (0.6, color, alpha * 0.35), (1, color, 0)], x1, y1, x2, y2)
    return f'<path d="{d}" fill="{paint}"/>'


def flake(rng: random.Random, x: float, y: float, size: float) -> str:
    """One torn gold-leaf flake: an irregular quad/pentagon."""
    k = rng.randrange(4, 7)
    a0 = rng.uniform(0, math.tau)
    return pts(
        (
            x + math.cos(a0 + i * math.tau / k) * size * rng.uniform(0.45, 1),
            y + math.sin(a0 + i * math.tau / k) * size * rng.uniform(0.45, 1),
        )
        for i in range(k)
    )


def flakes(c: Canvas, rng: random.Random, spots) -> str:
    """Loose gold-leaf flakes; spots = (x, y, size). Each takes a foil tone and a lit edge."""
    out = []
    for x, y, size in spots:
        d = flake(rng, x, y, size)
        tone = ramp(FOIL, rng.uniform(0.35, 0.95))
        paint = c.lin([(0, GOLD["light"]), (0.5, tone), (1, GOLD["shadow"])], 0, 0, 1, 1)
        out.append(f'<path d="{d}" fill="{paint}"/>')
    return "".join(out)


# --- the 千 glyph ---------------------------------------------------------------------------------------------
def glyph_in(x: float, y: float, w: float, h: float) -> str:
    """Transform that fits the seal's 千 into a box (uniform scale, centred)."""
    x0, y0, x1, y1 = GLYPH["bbox"]
    s = min(w / (x1 - x0), h / (y1 - y0))
    return f"translate({n(x + (w - (x1 - x0) * s) / 2 - x0 * s)} {n(y + (h - (y1 - y0) * s) / 2 - y0 * s)}) scale({s:.5f})"


def sen(transform: str, fill: str, bold=30.0, opacity=1.0) -> str:
    o = f' opacity="{n(opacity)}"' if opacity < 1 else ""
    return (
        f'<path transform="{transform}" fill="{fill}" stroke="{fill}" stroke-width="{n(bold)}" stroke-linejoin="round"{o} '
        f'd="{GLYPH["d"]}"/>'
    )


SEAL_UNITS = 512  # the seal master's box (build.py seal_group): its frames and glyph are placed in these units
SEAL_FRAME, SEAL_HAIRLINE = (34, 16, 10), (60, 4, 4)  # inset, stroke width, corner radius
SEAL_GLYPH_BOX, SEAL_GLYPH_LIFT, SEAL_BOLD = 90, 4, 22


def carved_seal(x: float, y: float, size: float, ink: str, catch: str = "", catch_opacity: float = 0.7) -> str:
    """The seal's own carving at any size, in one ink and with no field: heavy frame, hairline frame and 千 exactly as
    in brand/senryo-seal.svg (build.py seal_group). Wherever the seal appears carved, stamped or printed, it is this.
    `catch` adds the line of light a carved edge catches."""
    k = size / SEAL_UNITS

    def inked(colour: str) -> str:
        frames = "".join(
            f'<rect x="{n(x + inset * k)}" y="{n(y + inset * k)}" width="{n(size - 2 * inset * k)}" height="{n(size - 2 * inset * k)}" '
            f'rx="{n(radius * k)}" fill="none" stroke="{colour}" stroke-width="{n(width * k)}"/>'
            for inset, width, radius in (SEAL_FRAME, SEAL_HAIRLINE)
        )
        box = SEAL_GLYPH_BOX * k
        return frames + sen(glyph_in(x + box, y + box - SEAL_GLYPH_LIFT * k, size - 2 * box, size - 2 * box), colour, SEAL_BOLD)

    under = f'<g transform="translate({n(2 * k)} {n(2.6 * k)})" opacity="{n(catch_opacity)}">{inked(catch)}</g>' if catch else ""
    return under + inked(ink)


def seal_tile(c: Canvas, x: float, y: float, size: float, carve: str = LACQUER["shadow"]) -> str:
    """The seal as a gold-leaf tile with a carved 千 (the venue chip's construction at any size)."""
    r = size * 14 / 512 * 2.2
    face = c.lin([(0, GOLD["light"]), (0.42, GOLD["mid"]), (1, GOLD["shadow"])], 0, 0, 1, 1)
    bevel = c.lin([(0, GOLD["light"]), (0.5, GOLD["light"], 0), (1, GOLD["shadow"], 0.9)], 0, 0, 1, 1)
    t = glyph_in(x + size * 0.16, y + size * 0.14, size * 0.68, size * 0.68)
    return (
        f'<rect x="{n(x)}" y="{n(y)}" width="{n(size)}" height="{n(size)}" rx="{n(r)}" fill="{face}"/>'
        f'<rect x="{n(x + 0.8)}" y="{n(y + 0.8)}" width="{n(size - 1.6)}" height="{n(size - 1.6)}" rx="{n(r)}" fill="none" '
        f'stroke="{bevel}" stroke-width="1.6"/>'
        f"{sen(f'translate(0.8 1) {t}', GOLD['light'], 34, 0.55)}{sen(t, carve, 34)}"
    )


# --- embedding other masters and real marks -------------------------------------------------------------------
def embed(c: Canvas, path: str, x: float, y: float, size: float) -> str:
    """Places another SVG (a registered mark or one of our masters) uniformly scaled into a size × size box at (x, y).
    The mark is never recoloured or distorted; ids are re-prefixed; an owner's drop-shadow filter is dropped (as the
    identity codegen does on native) because the scene supplies its own shadow layer."""
    with open(os.path.join(ROOT, path)) as f:
        raw = f.read()
    vx, vy, vw, vh = (float(v) for v in re.split(r"[\s,]+", re.search(r'viewBox="([^"]+)"', raw).group(1).strip()))
    root_fill = re.search(r"<svg[^>]*\sfill=\"([^\"]+)\"", raw)
    inner = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", raw, flags=re.S)
    inner = re.sub(r"<\?xml[^>]*>|<!--.*?-->|<title>.*?</title>|<metadata>.*?</metadata>", "", inner, flags=re.S)
    inner = re.sub(r"<filter\b.*?</filter>", "", inner, flags=re.S)
    inner = re.sub(r'\sfilter="[^"]*"', "", inner)
    inner = re.sub(r'style="stop-color:\s*([^;"]+);?"', r'stop-color="\1"', inner)
    pre = c.uid("e")
    inner = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{pre}-{m.group(1)}"', inner)
    inner = re.sub(r'(href=")#([^"]+)"', lambda m: f'{m.group(1)}#{pre}-{m.group(2)}"', inner)
    inner = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{pre}-{m.group(1)})", inner)
    inner = re.sub(r"\s*\n\s*", " ", inner).strip()
    s = size / max(vw, vh)
    fill = f' fill="{root_fill.group(1)}"' if root_fill else ""
    return f'<g transform="translate({n(x)} {n(y)}) scale({s:.5f}) translate({n(-vx)} {n(-vy)})"{fill}>{inner}</g>'


def write(folder: str, name: str, body: str) -> str:
    assert "<text" not in body and "<filter" not in body and "<style" not in body, name
    out = os.path.join(ART, folder)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, name), "w") as f:
        f.write(body)
    return os.path.relpath(os.path.join(out, name), ROOT)
