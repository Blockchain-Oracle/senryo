"""Pending-passkey art: what the screen shows while the OS sheet owns the ceremony. The same key and lacquer tablet as
scene 2, alone on a transparent ground: the key hovers over its bed with its tag. It can sway and glint while the
action is pending; it never counts, fills or scans, because nothing here knows how far the OS has got."""
import random

from keyart import cord, key, key_bed, key_outline, tablet, tag, tag_outline
from kit import INK, LACQUER, PRACTICE, Canvas, n, rot, soft_ellipse, soft_path
from props import sparkle

KEY = "passkey-pending"
SIZE = 640
SEED = 1808
TINT = "#8B95FF"  # the light the silver picks up: the app's own link blue on either theme
TABLET_AT, TABLET_W, TABLET_H, TABLET_R, TABLET_TILT = (350, 300), 360, 388, 54, -7
KEY_AT, KEY_TILT, KEY_SCALE = (158, 392), -43, 0.84
BED_DROP = (13, 18)  # the bed lies straight under the hovering key: only a sliver of it shows
TAG_AT, TAG_TILT, TAG_SCALE = (120, 486), 12, 0.84


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Passkey pending: the key hovers over its lacquer bed (Senryo original)", SIZE, SIZE)
    rng = random.Random(SEED)
    slab, slab_outline = tablet(c, TABLET_W, TABLET_H, TABLET_R, rng, TINT, 0.7)
    slab_t = f"translate({TABLET_AT[0]} {TABLET_AT[1]}) rotate({TABLET_TILT})"
    bx, by = rot((KEY_AT[0] + BED_DROP[0] - TABLET_AT[0], KEY_AT[1] + BED_DROP[1] - TABLET_AT[1]), -TABLET_TILT)
    bed_t = f"translate({n(bx)} {n(by)}) rotate({KEY_TILT - TABLET_TILT}) scale({KEY_SCALE})"
    key_t = f"translate({KEY_AT[0]} {KEY_AT[1]}) rotate({KEY_TILT}) scale({KEY_SCALE})"
    tag_t = f"translate({TAG_AT[0]} {TAG_AT[1]}) rotate({TAG_TILT}) scale({TAG_SCALE})"
    c.put("shadow", soft_ellipse(c, TABLET_AT[0] + 22, TABLET_AT[1] + 214, 216, 40, LACQUER["shadow"], 0.28))
    c.put("tablet", f'<g transform="{slab_t}">{slab}<g transform="{bed_t}">{key_bed(c, KEY_TILT)}</g></g>')
    cord_shadow, cord_body = cord([(198, 404), (172, 436), (124, 446), (120, 486)], PRACTICE["deep"], PRACTICE["mid"], 8)
    c.put(
        "tag",
        soft_path(tag_outline(), 12, INK, 0.16, transform=f"translate(4 7) {tag_t}", name=f"{KEY}-tag-shadow"),
        f'<g id="{KEY}-cord-shadow">{cord_shadow}</g><g id="{KEY}-cord">{cord_body}</g>',
        f'<g id="{KEY}-tag-plate" transform="{tag_t}">{tag(c)}</g>',
    )
    c.put("key-shadow", soft_path(key_outline(), 16, INK, 0.3, transform=f"translate({BED_DROP[0]} {BED_DROP[1]}) {key_t}"))
    c.put("key", f'<g transform="{key_t}">{key(c, KEY_TILT, TINT)}</g>')
    c.put("glints", sparkle(566, 100, 20, TINT, 0.95) + sparkle(92, 250, 13, PRACTICE["mid"], 0.9, 10))
    return f"{KEY}.svg", c.svg()
