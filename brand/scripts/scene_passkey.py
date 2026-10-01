"""Scene 2 · Passkey. An original silver key settles toward its bed in a lacquer tablet; a small phone is the device
cue and a lacquer tag carries the seal. No scan, no progress, no sync claim: the OS owns the ceremony."""
import random

from kit import FIELD, INK, LACQUER, PRACTICE, SILVER, WHITE, Canvas, contact, field, gloss, n, pts, rot, rrect, seal_tile, shade, soft_path
from keyart import cord, key, key_bed, key_outline, tablet, tag, tag_outline
from props import sparkle

KEY = "scene-passkey"
COLOR = FIELD["periwinkle"]
SEED = 1202
TABLET_AT, TABLET_W, TABLET_H, TABLET_R, TABLET_TILT = (352, 548), 430, 520, 60, -7
KEY_AT, KEY_TILT, KEY_SCALE = (140, 664), -43, 1.0
BED_DROP = (15, 21)  # the bed lies straight under the hovering key, this far down-right: only a sliver of it shows
PHONE_AT, PHONE_W, PHONE_H, PHONE_R, PHONE_TILT = (622, 262), 172, 344, 38, 12
TAG_AT, TAG_TILT = (96, 800), 12


def phone(c: Canvas) -> tuple[str, str]:
    """A small phone face up, origin at its centre: silver frame, dark glass, the seal on its screen. No fake UI."""
    w, h, r = PHONE_W, PHONE_H, PHONE_R
    x, y = -w / 2, -h / 2
    outline = rrect(x, y, w, h, r)
    frame = c.lin([(0, SILVER["light"]), (0.4, SILVER["mid"]), (1, SILVER["shadow"])], 0, 0, 1, 1)
    glass = c.lin([(0, "#2A2440"), (0.5, "#16121F"), (1, "#0B0910")], 0, 0, 1, 1)
    clip = c.clip(f'<path d="{rrect(x + 8, y + 8, w - 16, h - 16, r - 7)}"/>')
    edge = "".join(f'<path d="{rrect(x + k * 7, y + k * 12, w, h, r)}" fill="{tone}"/>' for k, tone in ((1, "#3F4654"), (0.6, "#586172"), (0.3, "#7A8597")))
    band = pts([(x + w * 0.5, y), (x + w * 0.95, y), (x + w * 0.35, y + h), (x - w * 0.1, y + h)])
    tile = 62
    return (
        f"{edge}"
        f'<path d="{outline}" fill="{frame}"/>'
        f'<path d="{rrect(x + 5, y + 5, w - 10, h - 10, r - 4)}" fill="#0A080D"/>'
        f'<path d="{rrect(x + 8, y + 8, w - 16, h - 16, r - 7)}" fill="{glass}"/>'
        f'<g clip-path="{clip}">{gloss(c, band, 0.16, 0, 0, 0.5, 1)}</g>'
        f'<rect x="-30" y="{n(y + 22)}" width="60" height="18" rx="9" fill="#050407"/>'
        f"{seal_tile(c, -tile / 2, -tile / 2 - 6, tile)}"
        f'<rect x="-34" y="{n(y + h - 26)}" width="68" height="5" rx="2.5" fill="{WHITE}" fill-opacity=".5"/>',
        outline,
    )


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Passkey: a silver key settles into its lacquer bed beside a phone (Senryo original)")
    rng = random.Random(SEED)
    field(c, COLOR)
    dark = shade(COLOR, 0.82)
    slab, slab_outline = tablet(c, TABLET_W, TABLET_H, TABLET_R, rng, COLOR)
    slab_t = f"translate({TABLET_AT[0]} {TABLET_AT[1]}) rotate({TABLET_TILT})"
    bx, by = rot((KEY_AT[0] + BED_DROP[0] - TABLET_AT[0], KEY_AT[1] + BED_DROP[1] - TABLET_AT[1]), -TABLET_TILT)
    bed_t = f"translate({n(bx)} {n(by)}) rotate({KEY_TILT - TABLET_TILT}) scale({KEY_SCALE})"
    device, device_outline = phone(c)
    device_t = f"translate({PHONE_AT[0]} {PHONE_AT[1]}) rotate({PHONE_TILT})"
    key_t = f"translate({KEY_AT[0]} {KEY_AT[1]}) rotate({KEY_TILT}) scale({KEY_SCALE})"
    tag_t = f"translate({TAG_AT[0]} {TAG_AT[1]}) rotate({TAG_TILT})"
    c.put("shadow", contact(slab_outline, dark, slab_t, 0.8, f"{KEY}-tablet-shadow"), contact(device_outline, dark, device_t, 0.7, f"{KEY}-phone-shadow"))
    c.put(
        "back",
        f'<g id="{KEY}-tablet" transform="{slab_t}">{slab}<g transform="{bed_t}">{key_bed(c, KEY_TILT)}</g></g>',
        f'<g id="{KEY}-phone" transform="{device_t}">{device}</g>',
    )
    cord_shadow, cord_body = cord([(188, 676), (160, 724), (100, 744), (96, 800)], PRACTICE["deep"], PRACTICE["mid"], 9)
    # The key floats above the tablet: its shadow lands on the lacquer, offset by its height, and moves on its own.
    c.put(
        "main",
        soft_path(tag_outline(), 9, INK, 0.3, transform=f"translate(6 10) {tag_t}", name=f"{KEY}-tag-shadow"),
        f'<g id="{KEY}-cord-shadow">{cord_shadow}</g><g id="{KEY}-cord">{cord_body}</g>',
        f'<g id="{KEY}-tag" transform="{tag_t}">{tag(c)}</g>',
        soft_path(key_outline(), 18, INK, 0.3, transform=f"translate({BED_DROP[0]} {BED_DROP[1]}) {key_t}", name=f"{KEY}-key-shadow"),
        f'<g id="{KEY}-key" transform="{key_t}">{key(c, KEY_TILT, COLOR)}</g>',
    )
    c.put(
        "fore",
        f'<g id="{KEY}-glints">{sparkle(92, 452, 20, WHITE, 0.9, 8)}{sparkle(130, 498, 9, WHITE, 0.75, 20)}'
        f'{sparkle(690, 498, 15, WHITE, 0.85)}{sparkle(664, 620, 20, LACQUER["shadow"], 0.45)}{sparkle(626, 668, 9, LACQUER["shadow"], 0.36, 20)}</g>',
    )
    return f"{KEY}.svg", c.svg()
