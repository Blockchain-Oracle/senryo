"""Scene 5 · Kinpaku. The card as an object: lacquer body, a torn field of gold leaf with one sheen direction, the
carved seal. Behind it, the craft it is named for: a book of beaten gold leaf between washi sheets and the bamboo
tweezers that lift it. No network mark, no number, no claim about where it can be used."""
import random

from kit import FIELD, FOIL, GOLD, INK, PAPER, WHITE, Canvas, contact, field, flakes, n, pts, rrect, shade
from props import foil_paint, kinpaku_card, leaf_squares, torn_edge

KEY = "scene-kinpaku"
COLOR = FIELD["pink"]
SEED = 1505
CARD_AT, CARD_W, CARD_TILT = (80, 548), 596, -14
BOOK_AT, BOOK_SIZE, BOOK_TILT, BOOK_SHEETS = (508, 280), 236, 11, 5
LEAF_INSET = 20
BAMBOO = ("#F3E7BE", "#D8C489", "#A08A52")


def leaf_book(c: Canvas, rng: random.Random) -> tuple[str, str]:
    """A stack of washi with a sheet of beaten gold on top, one corner lifting. Origin at the centre."""
    s = BOOK_SIZE
    x = y = -s / 2
    outline = rrect(x, y, s, s, 5)
    paper = c.lin([(0, PAPER["light"]), (0.6, PAPER["mid"]), (1, PAPER["shade"])], 0, 0, 1, 1)
    sheets = "".join(
        f'<g transform="translate({n(k * 3.2)} {n(k * 4.6)}) rotate({n(rng.uniform(-2.4, 2.4))})">'
        f'<path d="{outline}" fill="{PAPER["shade"]}"/><path d="{rrect(x, y, s - 1.4, s - 1.8, 5)}" fill="{paper}"/></g>'
        for k in range(BOOK_SHEETS - 1, -1, -1)
    )
    g = s - 2 * LEAF_INSET
    gx = gy = -g / 2
    top = torn_edge(rng, (gx, gy), (gx, gy + g), 2.2, 18)
    right = [(gx + g + dx - gx, yy) for dx, yy in torn_edge(rng, (gx, gy), (gx, gy + g), 2.2, 18)]
    lift = g * 0.24  # the lifted corner, bottom right
    leaf = pts([*top, (gx + g - lift, gy + g), (gx + g, gy + g - lift), *reversed(right[:-6])])
    clip = c.clip(f'<path d="{leaf}"/>')
    sheen = c.lin([(0, WHITE, 0), (0.5, WHITE, 0.55), (1, WHITE, 0)], 0, 0, 1, 0.4)
    under = c.lin([(0, FOIL[3]), (1, FOIL[1])], 0, 0, 1, 1)
    fx, fy = gx + g - lift * 0.74, gy + g - lift * 0.74
    fold = f"M{n(gx + g - lift)} {n(gy + g)}Q{n(gx + g - lift * 0.3)} {n(gy + g - lift * 0.3)} {n(gx + g)} {n(gy + g - lift)}Q{n(fx + lift * 0.1)} {n(fy + lift * 0.1)} {n(fx)} {n(fy)}Z"
    return (
        f"{sheets}"
        f'<path d="{leaf}" fill="{GOLD["shadow"]}" fill-opacity=".3" transform="translate(.8 1.2)"/>'
        f'<path d="{leaf}" fill="{foil_paint(c, 0.1, 0, 0.9, 1)}"/>'
        f'<g clip-path="{clip}">{leaf_squares(c, rng, g, g, g / 1.5).replace("<g transform=\"rotate(", f"<g transform=\"translate({n(gx)} {n(gy)}) rotate(")}'
        f'<path d="{pts([(gx + g * 0.18, gy), (gx + g * 0.42, gy), (gx + g * 0.2, gy + g), (gx - g * 0.04, gy + g)])}" fill="{sheen}"/></g>'
        f'<path d="{fold}" fill="{INK}" fill-opacity=".16" transform="translate(2 3)"/>'
        f'<path d="{fold}" fill="{under}"/>'
        f'<path d="M{n(gx + g - lift)} {n(gy + g)}Q{n(gx + g - lift * 0.3)} {n(gy + g - lift * 0.3)} {n(gx + g)} {n(gy + g - lift)}" fill="none" stroke="{GOLD["light"]}" stroke-width="1.4"/>',
        outline,
    )


def tweezers(c: Canvas, length: float) -> str:
    """Bamboo leaf tweezers (竹箸), origin at the joined end, pointing along +x."""
    cane = c.lin([(0, BAMBOO[0]), (0.5, BAMBOO[1]), (1, BAMBOO[2])], 0, 0, 0, 1)
    arm = f"M0 -9Q{n(length * 0.5)} -15 {n(length)} -5L{n(length)} 0Q{n(length * 0.5)} -3 0 0Z"
    arm2 = f"M0 9Q{n(length * 0.5)} 15 {n(length)} 5L{n(length)} 1Q{n(length * 0.5)} 4 0 0Z"
    return (
        f'<g id="{KEY}-tweezers-shadow" fill="{INK}" fill-opacity=".2" transform="translate(4 7)"><path d="{arm}"/><path d="{arm2}"/></g>'
        f'<path d="{arm}" fill="{cane}"/><path d="{arm2}" fill="{cane}"/>'
        f'<rect x="-6" y="-11" width="30" height="22" rx="5" fill="{BAMBOO[2]}"/>'
        f'<rect x="-6" y="-11" width="30" height="9" rx="4" fill="{BAMBOO[1]}"/>'
        f'<path d="M30 -10.6Q{n(length * 0.5)} -15.4 {n(length - 6)} -5.4" fill="none" stroke="{WHITE}" stroke-opacity=".6" stroke-width="1.4"/>'
    )


def build() -> tuple[str, str]:
    c = Canvas(KEY, "Kinpaku: the lacquer and gold-leaf card with a book of beaten gold leaf (Senryo original)")
    rng = random.Random(SEED)
    field(c, COLOR)
    dark = shade(COLOR, 0.8)
    card, card_outline = kinpaku_card(c, CARD_W)
    card_t = f"translate({CARD_AT[0]} {CARD_AT[1]}) rotate({CARD_TILT})"
    book, book_outline = leaf_book(c, rng)
    book_t = f"translate({BOOK_AT[0]} {BOOK_AT[1]}) rotate({BOOK_TILT})"
    c.put(
        "shadow",
        contact(book_outline, dark, book_t, 0.7, f"{KEY}-leaf-book-shadow"),
        contact(card_outline, dark, card_t, 0.7, f"{KEY}-card-shadow"),
    )
    c.put(
        "back",
        f'<g id="{KEY}-leaf-book" transform="{book_t}">{book}</g>',
        f'<g id="{KEY}-tweezers" transform="translate(646 118) rotate(114)">{tweezers(c, 250)}</g>',
    )
    c.put("main", f'<g id="{KEY}-card" transform="{card_t}">{card}</g>')
    spots = [(668, 474, 11), (700, 514, 6), (104, 824, 15), (150, 866, 7), (78, 300, 9), (112, 262, 5)]
    c.put("fore", f'<g id="{KEY}-flakes">{flakes(c, rng, spots)}</g>')
    return f"{KEY}.svg", c.svg()
