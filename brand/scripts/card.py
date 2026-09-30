"""Kinpaku 金箔 card art (front + back). ISO/IEC 7810 ID-1: 85.6 × 54 mm → viewBox 856 × 540 (0.1 mm units).

Gold leaf is laid as overlapping square sheets (as real kinpaku is applied), torn along one edge, with loose
flakes drifting into the lacquer. Deterministic (seeded) so re-renders are identical.
"""
import math
import random

W, H, R = 856, 540, 32  # card, corner radius 3.2 mm


def _torn_edge(
    rng: random.Random, base: float, amp: float, y0: float, y1: float, jag_max: float = 4.5, tears: bool = True
) -> list[tuple[float, float]]:
    pts = []
    y = y0
    phase = rng.random() * math.tau
    while y <= y1:
        wave = math.sin(y / 67 + phase) * amp + math.sin(y / 23 + phase * 2) * amp * 0.35
        jag = rng.uniform(-jag_max, jag_max)
        if tears and rng.random() < 0.06:
            jag -= rng.uniform(8, 18)  # an occasional deeper tear
        pts.append((base + wave + jag, y))
        y += rng.uniform(3, 7)
    pts.append((base, y1))
    return pts


def _flake(rng: random.Random, cx: float, cy: float, size: float) -> str:
    n = rng.randint(4, 7)
    pts = []
    for i in range(n):
        a = i / n * math.tau + rng.uniform(-0.35, 0.35)
        r = size * rng.uniform(0.45, 1.0)
        pts.append(f"{cx + math.cos(a) * r:.1f},{cy + math.sin(a) * r:.1f}")
    return " ".join(pts)


def _defs(foil: list[str], lacquer: str, lacquer_edge: str) -> str:
    hi, light, mid, shade, deep = foil
    grads = []
    # Three sheet sheens at different angles: the patchwork is what makes leaf read as leaf, not paint.
    for gid, (x1, y1, x2, y2) in {"leafA": (0, 0, 1, 1), "leafB": (1, 0, 0, 1), "leafC": (0, 1, 1, 0)}.items():
        grads.append(
            f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'
            f'<stop offset="0" stop-color="{mid}"/><stop offset=".45" stop-color="{light}" stop-opacity=".92"/>'
            f'<stop offset="1" stop-color="{shade}"/></linearGradient>'
        )
    grads.append(
        f'<linearGradient id="flake" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{hi}"/>'
        f'<stop offset=".5" stop-color="{mid}"/><stop offset="1" stop-color="{shade}"/></linearGradient>'
    )
    grads.append(
        f'<radialGradient id="lacquer" cx=".72" cy=".18" r=".95"><stop offset="0" stop-color="{lacquer_edge}"/>'
        f'<stop offset=".55" stop-color="{lacquer}"/><stop offset="1" stop-color="{lacquer}"/></radialGradient>'
    )
    # One broad sheen across the whole leaf field: metal catches light as a single plane, not per tile.
    grads.append(
        f'<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{hi}" stop-opacity="0"/>'
        f'<stop offset=".35" stop-color="{hi}" stop-opacity=".55"/><stop offset=".5" stop-color="{hi}" stop-opacity="0"/>'
        f'<stop offset=".8" stop-color="{deep}" stop-opacity=".35"/><stop offset="1" stop-color="{deep}" stop-opacity=".55"/>'
        "</linearGradient>"
    )
    grads.append(
        '<filter id="grain" x="0" y="0" width="100%" height="100%">'
        '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="11"/>'
        '<feColorMatrix type="matrix" values="0 0 0 0 0.43  0 0 0 0 0.34  0 0 0 0 0  0 0 0 0.55 -0.12"/>'
        "</filter>"
    )
    grads.append(f'<clipPath id="card"><rect width="{W}" height="{H}" rx="{R}"/></clipPath>')
    return "".join(grads)


def _leaf_field(rng: random.Random, clip_id: str, x0: float, y0: float, x1: float, y1: float, seam: str) -> str:
    sheet = 118
    out = [f'<g clip-path="url(#{clip_id})">']
    ids = ["leafA", "leafB", "leafC"]
    y = y0 - sheet * 0.3
    row = 0
    while y < y1:
        x = x0 - sheet * 0.5 + (row % 2) * sheet * 0.35
        while x < x1:
            jx, jy, rot = rng.uniform(-4, 4), rng.uniform(-4, 4), rng.uniform(-0.9, 0.9)
            gid = rng.choice(ids)
            out.append(
                f'<rect x="{x + jx:.1f}" y="{y + jy:.1f}" width="{sheet + 8}" height="{sheet + 8}" '
                f'transform="rotate({rot:.2f} {x + sheet / 2:.1f} {y + sheet / 2:.1f})" fill="url(#{gid})" '
                f'stroke="{seam}" stroke-opacity=".22" stroke-width=".7"/>'
            )
            x += sheet
        y += sheet
        row += 1
    out.append(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="url(#sheen)"/>')
    out.append(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" filter="url(#grain)"/>')
    out.append("</g>")
    return "".join(out)


def _flakes(rng: random.Random, edge_x: float, span: float, y0: float, y1: float, count: int) -> str:
    out = []
    for _ in range(count):
        d = rng.random() ** 2.2 * span  # dense near the tear, sparse farther out
        cx = edge_x + d + rng.uniform(-6, 10)
        cy = rng.uniform(y0, y1)
        size = max(0.9, rng.uniform(1.2, 7.5) * (1 - d / span * 0.7))
        op = 0.95 - d / span * 0.55
        out.append(f'<polygon points="{_flake(rng, cx, cy, size)}" fill="url(#flake)" opacity="{op:.2f}"/>')
    return "".join(out)


def build_cards(outline, fit, svg, seal_group, write, mincho, mono, lacquer, lacquer_edge, foil, ink, gold):
    rng = random.Random(1000)  # 千
    hi, light, mid, shade, deep = foil
    kinpaku = outline(mono, "KINPAKU", 260)
    kin_kanji = outline(mincho, "金箔")
    senryo = outline(mono, "SENRYO", 140)
    defs = _defs(foil, lacquer, lacquer_edge)

    # Front ---------------------------------------------------------------------------------------------------
    edge = _torn_edge(rng, 318, 16, -10, H + 10)
    poly = " ".join(f"{x:.1f},{y:.1f}" for x, y in edge)
    field_clip = f'<clipPath id="field"><polygon points="-10,-10 {poly} -10,{H + 10}"/></clipPath>'
    flakes = _flakes(rng, 318, 330, 8, H - 8, 110)

    def txt(glyph, x, y, cap, fill, align="left"):
        x0, y0, x1, y1 = glyph["bbox"]
        s = cap / (y1 - y0)
        w = (x1 - x0) * s
        left = x - w if align == "right" else x
        return f'<path transform="translate({left - x0 * s:.2f} {y - y0 * s:.2f}) scale({s:.5f})" fill="{fill}" d="{glyph["d"]}"/>'

    seal = 74
    front = [
        f'<g clip-path="url(#card)">',
        f'<rect width="{W}" height="{H}" fill="url(#lacquer)"/>',
        _leaf_field(rng, "field", -10, -10, 360, H + 10, deep),
        flakes,
        # 角印 stamped onto the leaf: lacquer square, gold carving.
        f'<g transform="translate(44 44)">{seal_group(seal, lacquer, mid, simple=False)}</g>',
        txt(senryo, 46, H - 46 - 15, 15, lacquer),
        txt(kinpaku, W - 48, 50, 17, light, align="right"),
        txt(kin_kanji, W - 48, 82, 19, shade, align="right"),
        "</g>",
        f'<rect x=".75" y=".75" width="{W - 1.5}" height="{H - 1.5}" rx="{R - 0.75}" fill="none" '
        f'stroke="{lacquer_edge}" stroke-width="1.5"/>',
    ]
    write(
        "kinpaku-card.svg",
        svg(W, H, "\n  ".join(front), "Kinpaku 金箔 card", extra_defs=defs + field_clip),
    )

    # Back: a torn leaf band where a magstripe would be, the seal in mono gold, quiet type ------------------------
    rng_b = random.Random(2000)  # 両
    top = _torn_edge(rng_b, 0, 2.5, -10, W + 10, jag_max=1.8, tears=False)
    bottom = _torn_edge(rng_b, 0, 4, -10, W + 10, jag_max=2.6, tears=False)
    band_y, band_h = 64, 52
    band_pts = " ".join(f"{y:.1f},{band_y + x:.1f}" for x, y in top) + " " + " ".join(
        f"{y:.1f},{band_y + band_h + x:.1f}" for x, y in reversed(bottom)
    )
    band_clip = f'<clipPath id="band"><polygon points="{band_pts}"/></clipPath>'
    back = [
        f'<g clip-path="url(#card)">',
        f'<rect width="{W}" height="{H}" fill="url(#lacquer)"/>',
        _leaf_field(rng_b, "band", -10, band_y - 20, W + 10, band_y + band_h + 20, deep),
        f'<g transform="translate({W - 48 - 56} {H - 48 - 56})">{seal_group(56, "none", mid, edge=mid)}</g>',
        txt(kinpaku, 48, H - 48 - 34, 12, light),
        txt(kin_kanji, 48, H - 48 - 14, 14, shade),
        "</g>",
        f'<rect x=".75" y=".75" width="{W - 1.5}" height="{H - 1.5}" rx="{R - 0.75}" fill="none" '
        f'stroke="{lacquer_edge}" stroke-width="1.5"/>',
    ]
    write(
        "kinpaku-card-back.svg",
        svg(W, H, "\n  ".join(back), "Kinpaku 金箔 card (back)", extra_defs=defs + band_clip),
    )
    _ = (hi, ink, gold, fit)
