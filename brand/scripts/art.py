"""Original Senryo identity art (S1b.3 first-pass masters, v2 direction §10): XAU koban, XAG chōgin and the five FX
flag-pair discs. Deterministic: same input, byte-identical output.

  python3 brand/scripts/art.py            # writes brand/art/*.svg

- Materials: the Living Lacquer ramps (v2-plan §5.2). Gold leaf #886426/#D4AE5B/#FFF0BC, silver #697383/#C9D0DD/#F4F6FB,
  lacquer #141414/#242424/#474747. Light comes from the upper left on every object (same viewpoint, same optical scale).
- The 千 is the seal's own outlined glyph (Zen Old Mincho Black, OFL; see brand/README.md), read from senryo-seal.svg,
  so there is no <text> and no font dependency anywhere.
- React Native renders these through react-native-svg: gradients, clip paths, masks and opacity only — no filters,
  no <style>, no <text>. Every id is prefixed with the file's key so marks never collide when inlined on the web.
- FX discs compose the public-domain flags in packages/identity/sources/flag-*/ (Wikimedia Commons originals;
  provenance in packages/identity/src/art/flags.ts). Flags are scaled uniformly (never distorted) and cropped by a disc.
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
ROOT = os.path.dirname(BRAND)
OUT = os.path.join(BRAND, "art")
SOURCES = os.path.join(ROOT, "packages", "identity", "sources")
# The Commons file behind each flag code (Canada: the Pantone file that supersedes Flag_of_Canada.svg).
FLAG_FILES = {
    "eu": "flag-eu/flag-eu.svg",
    "us": "flag-us/flag-us.svg",
    "gb": "flag-gb/flag-gb.svg",
    "jp": "flag-jp/flag-jp.svg",
    "ch": "flag-ch/flag-ch.svg",
    "ca": "flag-ca/flag-ca-pantone.svg",
}

GOLD = {"shadow": "#886426", "mid": "#D4AE5B", "light": "#FFF0BC"}
SILVER = {"shadow": "#697383", "mid": "#C9D0DD", "light": "#F4F6FB"}
LACQUER = {"shadow": "#141414", "mid": "#242424", "light": "#474747"}
INK = "#000000"

BOX = 256  # every object master is a 256 square
CENTER = BOX / 2


# --- the 千 glyph from the seal ---------------------------------------------------------------------------------
def seal_glyph() -> dict:
    with open(os.path.join(BRAND, "senryo-seal.svg")) as f:
        svg = f.read()
    d = re.search(r'<path[^>]*\sd="([^"]+)"', svg).group(1)
    xs, ys = [], []
    tokens = re.findall(r"[MLHVQCZ]|-?\d*\.?\d+", d)
    cmd, args = None, []
    for tok in tokens + ["Z"]:
        if tok.isalpha():
            cmd, args = tok, []
            continue
        args.append(float(tok))
        if cmd == "H":
            xs.append(args.pop())
        elif cmd == "V":
            ys.append(args.pop())
        elif len(args) == 2:
            xs.append(args[0])
            ys.append(args[1])
            args = []
    return {"d": d, "bbox": (min(xs), min(ys), max(xs), max(ys))}


GLYPH = seal_glyph()


def fit(box_x: float, box_y: float, box_w: float, box_h: float) -> str:
    """Uniformly scales the glyph bbox into the box and centres it."""
    x0, y0, x1, y1 = GLYPH["bbox"]
    s = min(box_w / (x1 - x0), box_h / (y1 - y0))
    tx = box_x + (box_w - (x1 - x0) * s) / 2 - x0 * s
    ty = box_y + (box_h - (y1 - y0) * s) / 2 - y0 * s
    return f"translate({tx:.2f} {ty:.2f}) scale({s:.5f})"


def glyph(transform: str, fill: str, bold: float, extra: str = "") -> str:
    return (
        f'<path transform="{transform}" fill="{fill}" stroke="{fill}" stroke-width="{bold:g}" '
        f'stroke-linejoin="round"{extra} d="{GLYPH["d"]}"/>'
    )


def shift(transform: str, dx: float, dy: float) -> str:
    return f"translate({dx:.2f} {dy:.2f}) {transform}"


# --- file plumbing ----------------------------------------------------------------------------------------------
def svg(key: str, title: str, defs: str, body: str, size: float = BOX) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {size:g} {size:g}" width="{size:g}" '
        f'height="{size:g}">\n  <title>{title}</title>\n  <defs>{defs}</defs>\n  {body}\n</svg>\n'
    )


def write(name: str, body: str) -> None:
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w") as f:
        f.write(body)
    print("wrote", os.path.relpath(os.path.join(OUT, name), ROOT))


def lin(pid: str, stops: list[tuple[float, str, float]], x1=0.0, y1=0.0, x2=1.0, y2=1.0, units="") -> str:
    u = f' gradientUnits="{units}"' if units else ""
    s = "".join(f'<stop offset="{o:g}" stop-color="{c}" stop-opacity="{a:g}"/>' for o, c, a in stops)
    return f'<linearGradient id="{pid}" x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}"{u}>{s}</linearGradient>'


def rad(pid: str, stops: list[tuple[float, str, float]], cx=0.5, cy=0.5, r=0.5, fx=None, fy=None) -> str:
    f = f' fx="{fx:g}" fy="{fy:g}"' if fx is not None else ""
    s = "".join(f'<stop offset="{o:g}" stop-color="{c}" stop-opacity="{a:g}"/>' for o, c, a in stops)
    return f'<radialGradient id="{pid}" cx="{cx:g}" cy="{cy:g}" r="{r:g}"{f}>{s}</radialGradient>'


def lacquer_disc(k: str, metal: dict) -> tuple[str, str]:
    """The authored lacquer plate the metals sit on in their disc variant (dark urushi, soft bloom, a metal rim)."""
    defs = (
        rad(f"{k}-lq", [(0, LACQUER["light"], 1), (0.55, LACQUER["mid"], 1), (1, LACQUER["shadow"], 1)], 0.34, 0.28, 0.9)
        + lin(f"{k}-lqrim", [(0, LACQUER["light"], 0.9), (0.5, LACQUER["mid"], 0.2), (1, INK, 0.5)])
        + lin(f"{k}-metalrim", [(0, metal["light"], 0.9), (0.5, metal["mid"], 0.55), (1, metal["shadow"], 0.7)])
    )
    body = (
        f'<circle cx="{CENTER}" cy="{CENTER}" r="{CENTER}" fill="url(#{k}-lq)"/>'
        f'<circle cx="{CENTER}" cy="{CENTER}" r="{CENTER - 1.5}" fill="none" stroke="url(#{k}-lqrim)" stroke-width="3"/>'
        f'<circle cx="{CENTER}" cy="{CENTER}" r="{CENTER - 9}" fill="none" stroke="url(#{k}-metalrim)" stroke-width="1.6"/>'
    )
    return defs, body


# --- XAU koban ---------------------------------------------------------------------------------------------------
KOBAN_RX, KOBAN_RY, KOBAN_TILT = 66, 106, -12
KOBAN_EDGE = (5, 8)  # coin thickness seen toward the lower right
GOZAME_STEP = 7.5  # hammer-line spacing (茣蓙目)


def koban(k: str) -> tuple[str, str]:
    rx, ry = KOBAN_RX, KOBAN_RY
    ex, ey = KOBAN_EDGE
    g = GOLD
    defs = (
        rad(f"{k}-cast", [(0, INK, 0.42), (0.7, INK, 0.16), (1, INK, 0)], 0.5, 0.5, 0.5)
        + lin(f"{k}-edge", [(0, g["shadow"], 1), (0.55, g["mid"], 1), (1, g["shadow"], 1)], 0, 0, 1, 0.3)
        + lin(f"{k}-face", [(0, "#F6DE9A", 1), (0.32, g["mid"], 1), (0.72, "#B48C43", 1), (1, g["shadow"], 1)], 0.1, 0, 0.9, 1)
        + rad(f"{k}-bloom", [(0, g["light"], 0.75), (0.6, g["light"], 0.12), (1, g["light"], 0)], 0.3, 0.22, 0.55)
        + lin(f"{k}-rim", [(0, g["light"], 0.95), (0.45, g["light"], 0.1), (0.55, g["shadow"], 0.1), (1, g["shadow"], 0.9)])
        + lin(f"{k}-seal", [(0, "#E6C471", 1), (1, "#A57C35", 1)], 0, 0, 0, 1)
        + lin(f"{k}-sheen", [(0, g["light"], 0), (0.46, g["light"], 0.5), (0.54, g["light"], 0.5), (1, g["light"], 0)], 0, 0, 1, 1)
        + f'<clipPath id="{k}-clip"><ellipse cx="{CENTER}" cy="{CENTER}" rx="{rx - 4}" ry="{ry - 4}"/></clipPath>'
    )
    lines = []
    y = CENTER - ry
    while y < CENTER + ry:
        lines.append(
            f'<path d="M{CENTER - rx} {y:.2f}H{CENTER + rx}" stroke="{g["shadow"]}" stroke-opacity=".3" stroke-width="1.3"/>'
            f'<path d="M{CENTER - rx} {y + 1.3:.2f}H{CENTER + rx}" stroke="{g["light"]}" stroke-opacity=".32" stroke-width=".9"/>'
        )
        y += GOZAME_STEP
    def crest(cy: float) -> str:
        """The small kiri-style stamp at top and bottom: a fan cartouche, three buds over paired leaves, in relief."""
        c = CENTER
        fan = f"M{c - 13} {cy - 6}Q{c} {cy - 13} {c + 13} {cy - 6}L{c + 9} {cy + 8}Q{c} {cy + 11} {c - 9} {cy + 8}Z"
        leaves = (
            f"M{c - 1} {cy + 6.5}Q{c - 8} {cy + 6} {c - 10} {cy + 1.5}Q{c - 4} {cy + 2} {c - 1} {cy + 6.5}Z"
            f"M{c + 1} {cy + 6.5}Q{c + 8} {cy + 6} {c + 10} {cy + 1.5}Q{c + 4} {cy + 2} {c + 1} {cy + 6.5}Z"
        )
        buds = "".join(
            f'<ellipse cx="{c + dx}" cy="{cy + dy}" rx="1.7" ry="3.3" fill="{g["shadow"]}" fill-opacity=".9"/>'
            for dx, dy in ((-5.5, -2.4), (0, -4.2), (5.5, -2.4))
        )
        return (
            f'<path transform="translate(.9 1.2)" d="{fan}" fill="{g["shadow"]}" fill-opacity=".55"/>'
            f'<path d="{fan}" fill="{g["mid"]}"/>'
            f'<path d="M{c - 12} {cy - 5.4}Q{c} {cy - 12} {c + 12} {cy - 5.4}" fill="none" stroke="{g["light"]}" '
            f'stroke-opacity=".9" stroke-width="1.1"/>'
            f'{buds}<path d="{leaves}" fill="{g["shadow"]}" fill-opacity=".85"/>'
        )

    t = fit(CENTER - 38, CENTER - 44, 76, 88)
    body = (
        f'<g transform="translate({ex + 4} {ey + 10}) rotate({KOBAN_TILT} {CENTER} {CENTER})">'
        f'<ellipse cx="{CENTER}" cy="{CENTER}" rx="{rx + 8}" ry="{ry + 8}" fill="url(#{k}-cast)"/></g>'
        f'<g transform="translate({ex} {ey}) rotate({KOBAN_TILT} {CENTER} {CENTER})">'
        f'<ellipse cx="{CENTER}" cy="{CENTER}" rx="{rx}" ry="{ry}" fill="url(#{k}-edge)"/>'
        f'<ellipse cx="{CENTER}" cy="{CENTER}" rx="{rx}" ry="{ry}" fill="{INK}" fill-opacity=".18"/></g>'
        f'<g transform="rotate({KOBAN_TILT} {CENTER} {CENTER})">'
        f'<ellipse cx="{CENTER}" cy="{CENTER}" rx="{rx}" ry="{ry}" fill="url(#{k}-face)"/>'
        f'<g clip-path="url(#{k}-clip)">{"".join(lines)}'
        f'<rect x="{CENTER - rx}" y="{CENTER - ry}" width="{2 * rx}" height="{2 * ry}" fill="url(#{k}-bloom)"/></g>'
        f'<ellipse cx="{CENTER}" cy="{CENTER}" rx="{rx - 1.5}" ry="{ry - 1.5}" fill="none" stroke="url(#{k}-rim)" stroke-width="3"/>'
        f'<ellipse cx="{CENTER}" cy="{CENTER}" rx="{rx - 7}" ry="{ry - 7}" fill="none" stroke="{g["shadow"]}" stroke-opacity=".35" stroke-width="1.2"/>'
        f"{crest(CENTER - ry + 26)}{crest(CENTER + ry - 26)}"
        f"{glyph(shift(t, 2.6, 3.2), g['shadow'], 30)}"
        f"{glyph(shift(t, -1.4, -1.6), g['light'], 30)}"
        f"{glyph(t, f'url(#{k}-seal)', 30)}"
        f'<path d="M{CENTER - rx + 10} {CENTER - 30}A{rx - 8} {ry - 8} 0 0 1 {CENTER - 18} {CENTER - ry + 9}" fill="none" '
        f'stroke="{g["light"]}" stroke-opacity=".9" stroke-width="3" stroke-linecap="round"/>'
        f'<g clip-path="url(#{k}-clip)"><path d="M{CENTER - 90} {CENTER - 40}L{CENTER - 40} {CENTER - 120}L{CENTER - 8} {CENTER - 120}'
        f'L{CENTER - 58} {CENTER - 40}Z" fill="url(#{k}-sheen)" opacity=".55"/></g>'
        "</g>"
    )
    return defs, body


# --- XAG chōgin --------------------------------------------------------------------------------------------------
CHOGIN_TILT = -32
CHOGIN_EDGE = (5, 8)
# A cast, sea-cucumber-shaped bar (丁銀): bulbous left end, a dip, a high middle, a tapering right end, a full belly.
CHOGIN_PATH = (
    "M18 138C14 120 26 106 44 104C58 102 66 110 80 108C100 104 112 94 136 94C160 94 176 100 196 99"
    "C216 98 236 104 240 120C244 136 232 146 214 146C194 146 178 152 160 158C140 165 118 170 94 168"
    "C72 166 60 172 42 166C24 160 20 152 18 138Z"
)
CHOGIN_RIDGE = "M34 114C50 108 62 115 80 114C100 111 114 101 136 101C160 101 176 106 198 106C214 106 226 108 232 115"
CHOGIN_BELLY = "M40 158C60 162 72 158 94 160C118 162 138 157 160 150C178 144 196 139 218 139"
# Casting ripples across the bar: (x, top y, bottom y) in local coordinates.
CHOGIN_RIPPLES = ((50, 108, 160), (70, 110, 161), (98, 102, 163), (166, 100, 154), (188, 101, 148), (212, 104, 141))


def chogin(k: str) -> tuple[str, str]:
    ex, ey = CHOGIN_EDGE
    s = SILVER
    tilt = f"rotate({CHOGIN_TILT} {CENTER} {CENTER})"
    defs = (
        rad(f"{k}-cast", [(0, INK, 0.4), (0.7, INK, 0.14), (1, INK, 0)], 0.5, 0.5, 0.5)
        + lin(f"{k}-edge", [(0, s["shadow"], 1), (0.5, s["mid"], 1), (1, s["shadow"], 1)], 0, 0, 1, 0.2)
        + lin(f"{k}-face", [(0, s["light"], 1), (0.4, s["mid"], 1), (0.78, "#9CA5B5", 1), (1, s["shadow"], 1)], 0.3, 0, 0.5, 1)
        + rad(f"{k}-bloom", [(0, s["light"], 0.9), (0.5, s["light"], 0.2), (1, s["light"], 0)], 0.32, 0.25, 0.55)
        + lin(f"{k}-stamp", [(0, "#DCE2EC", 1), (1, "#8D97A8", 1)], 0, 0, 0, 1)
        + f'<clipPath id="{k}-clip"><path d="{CHOGIN_PATH}"/></clipPath>'
    )
    t = fit(CENTER - 14, CENTER - 14, 28, 32)

    def oval_stamp(cx: float, cy: float, rx: float, ry: float) -> str:
        return (
            f'<ellipse cx="{cx + 0.9}" cy="{cy + 1.3}" rx="{rx}" ry="{ry}" fill="{s["shadow"]}" fill-opacity=".6"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#{k}-stamp)"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx - 3}" ry="{ry - 3}" fill="{s["shadow"]}" fill-opacity=".28"/>'
            f'<path d="M{cx - rx + 1.5:.2f} {cy - 1:.2f}A{rx - 1.5} {ry - 1.5} 0 0 1 {cx + rx * 0.4:.2f} {cy - ry + 1.3:.2f}" '
            f'fill="none" stroke="{s["light"]}" stroke-opacity=".95" stroke-width="1.2" stroke-linecap="round"/>'
        )

    ripples = "".join(
        f'<path d="M{x} {top + 7}Q{x + 6} {(top + bot) / 2} {x} {bot - 7}" fill="none" stroke="{s["shadow"]}" '
        f'stroke-opacity=".3" stroke-width="1.8" stroke-linecap="round"/>'
        f'<path d="M{x - 1.6} {top + 7}Q{x + 4.4} {(top + bot) / 2} {x - 1.6} {bot - 7}" fill="none" stroke="{s["light"]}" '
        f'stroke-opacity=".6" stroke-width="1.1" stroke-linecap="round"/>'
        for x, top, bot in CHOGIN_RIPPLES
    )
    body = (
        f'<g transform="translate({ex + 4} {ey + 8}) {tilt}"><ellipse cx="{CENTER + 2}" cy="{CENTER + 4}" rx="122" ry="44" '
        f'fill="url(#{k}-cast)"/></g>'
        f'<g transform="translate({ex} {ey}) {tilt}"><path d="{CHOGIN_PATH}" fill="url(#{k}-edge)"/>'
        f'<path d="{CHOGIN_PATH}" fill="{INK}" fill-opacity=".2"/></g>'
        f'<g transform="{tilt}">'
        f'<path d="{CHOGIN_PATH}" fill="url(#{k}-face)"/>'
        f'<g clip-path="url(#{k}-clip)"><rect x="0" y="80" width="{BOX}" height="100" fill="url(#{k}-bloom)"/>{ripples}'
        f'<path d="{CHOGIN_BELLY}" fill="none" stroke="{s["shadow"]}" stroke-opacity=".35" stroke-width="7" stroke-linecap="round"/></g>'
        f'<path d="{CHOGIN_PATH}" fill="none" stroke="{s["shadow"]}" stroke-opacity=".5" stroke-width="1.4"/>'
        f'<path d="{CHOGIN_RIDGE}" fill="none" stroke="{s["light"]}" stroke-opacity=".95" stroke-width="3" stroke-linecap="round"/>'
        f"{oval_stamp(58, 136, 10, 8)}{oval_stamp(202, 122, 9, 7)}"
        f'<circle cx="{CENTER + 1.4}" cy="{CENTER + 2}" r="21" fill="{s["shadow"]}" fill-opacity=".55"/>'
        f'<circle cx="{CENTER}" cy="{CENTER}" r="21" fill="url(#{k}-stamp)"/>'
        f'<circle cx="{CENTER}" cy="{CENTER}" r="18" fill="none" stroke="{s["shadow"]}" stroke-opacity=".5" stroke-width="1.2"/>'
        f'<path d="M{CENTER - 17} {CENTER - 4}A18 18 0 0 1 {CENTER + 8} {CENTER - 17}" fill="none" stroke="{s["light"]}" '
        f'stroke-opacity=".95" stroke-width="1.3" stroke-linecap="round"/>'
        f"{glyph(shift(t, 1.3, 1.7), s['shadow'], 34)}"
        f"{glyph(shift(t, -0.8, -1), s['light'], 34)}"
        f"{glyph(t, '#AEB7C6', 34)}"
        "</g>"
    )
    return defs, body


def metal_files(key: str, name: str, fn, metal: dict) -> None:
    defs, body = fn(key)
    write(f"{key}.svg", svg(key, f"{name} (Senryo original)", defs, body))
    dk = f"{key}-disc"
    ldefs, lbody = lacquer_disc(dk, metal)
    mdefs, mbody = fn(dk)
    scale = 0.8
    off = CENTER * (1 - scale)
    write(
        f"{dk}.svg",
        svg(dk, f"{name} on lacquer (Senryo original)", ldefs + mdefs, f'{lbody}<g transform="translate({off:g} {off:g}) scale({scale:g})">{mbody}</g>'),
    )


# --- FX flag-pair discs ------------------------------------------------------------------------------------------
BASE_R, QUOTE_R, PAIR_GAP = 86, 62, 8
BASE_C, QUOTE_C = (96, 96), (188, 188)
# Where the disc sits on each flag, as the fraction of flag width at the disc's centre (the US canton stays in view).
FLAG_FOCUS = {"us": 0.265, "eu": 0.5, "gb": 0.5, "jp": 0.5, "ch": 0.5, "ca": 0.5}


def flag_body(code: str, k: str) -> tuple[str, float, float]:
    """The flag's inner markup with ids prefixed, plus its viewBox width/height."""
    with open(os.path.join(SOURCES, FLAG_FILES[code])) as f:
        raw = f.read()
    vb = re.search(r'viewBox="([^"]+)"', raw)
    if vb:
        vx, vy, vw, vh = (float(v) for v in re.split(r"[\s,]+", vb.group(1).strip()))
    else:
        vx, vy = 0.0, 0.0
        vw = float(re.search(r'<svg[^>]*\swidth="([\d.]+)', raw).group(1))
        vh = float(re.search(r'<svg[^>]*\sheight="([\d.]+)', raw).group(1))
    inner = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", raw, flags=re.S)
    inner = re.sub(r"<\?xml[^>]*>|<!--.*?-->|<title>.*?</title>|<metadata>.*?</metadata>", "", inner, flags=re.S)
    inner = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{k}-{m.group(1)}"', inner)
    inner = re.sub(r'(href=")#([^"]+)"', lambda m: f'{m.group(1)}#{k}-{m.group(2)}"', inner)
    inner = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{k}-{m.group(1)})", inner)
    return f'<g transform="translate({-vx:g} {-vy:g})">{inner}</g>', vw, vh


def flag_disc(code: str, k: str, c: tuple[float, float], r: float) -> tuple[str, str]:
    inner, vw, vh = flag_body(code, k)
    s = 2 * r / min(vw, vh)  # cover the disc, uniform scale
    fx = FLAG_FOCUS[code] * vw * s
    tx = c[0] - min(max(fx, r), vw * s - r)
    ty = c[1] - vh * s / 2
    defs = f'<clipPath id="{k}-clip"><circle cx="{c[0]}" cy="{c[1]}" r="{r}"/></clipPath>'
    body = (
        f'<g clip-path="url(#{k}-clip)"><g transform="translate({tx:.3f} {ty:.3f}) scale({s:.6f})">{inner}</g>'
        f'<circle cx="{c[0]}" cy="{c[1]}" r="{r}" fill="url(#{k}-gloss)"/></g>'
        f'<circle cx="{c[0]}" cy="{c[1]}" r="{r - 1}" fill="none" stroke="{INK}" stroke-opacity=".16" stroke-width="2"/>'
    )
    defs += rad(f"{k}-gloss", [(0, "#FFFFFF", 0.14), (0.55, "#FFFFFF", 0), (1, INK, 0.08)], 0.35, 0.3, 0.75)
    return defs, body


def fx_pair(base: str, quote: str, key: str) -> None:
    bdefs, bbody = flag_disc(base, f"{key}-b", BASE_C, BASE_R)
    qdefs, qbody = flag_disc(quote, f"{key}-q", QUOTE_C, QUOTE_R)
    mask = (
        f'<mask id="{key}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="{BOX}" height="{BOX}">'
        f'<rect width="{BOX}" height="{BOX}" fill="#FFFFFF"/>'
        f'<circle cx="{QUOTE_C[0]}" cy="{QUOTE_C[1]}" r="{QUOTE_R + PAIR_GAP}" fill="{INK}"/></mask>'
    )
    body = f'<g mask="url(#{key}-cut)">{bbody}</g>{qbody}'
    title = f"{key.removeprefix('fx-').replace('-', '/').upper()} flag pair (Senryo original; public-domain flags)"
    write(f"{key}.svg", svg(key, title, bdefs + qdefs + mask, body))


if __name__ == "__main__":
    metal_files("xau-koban", "XAU koban", koban, GOLD)
    metal_files("xag-chogin", "XAG chōgin", chogin, SILVER)
    for flag, currency in (("eu", "eur"), ("gb", "gbp"), ("jp", "jpy"), ("ch", "chf"), ("ca", "cad")):
        fx_pair(flag, "us", f"fx-{currency}-usd")
    for name in sorted(n for n in os.listdir(OUT) if n.endswith(".svg")):  # subfolders belong to onboarding.py
        body = open(os.path.join(OUT, name)).read()
        assert "<text" not in body and "<filter" not in body and "<style" not in body, name
