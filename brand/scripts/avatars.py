"""The twelve default avatars: one family of illustrated portraits. Same kimono collar, same light from the upper
left, same way of drawing; what changes is the person: jaw, nose, eye spacing, skin, hair or headwear, expression, one
accessory, robe and ground. The face is the subject: it fills about half the disc so it still reads at 48 px.
Full-bleed 256 squares (the app clips them to a disc); an account keeps the one its address maps to until its owner
picks another. Robes and grounds come from the palette tokens (never the financial green or red); skin and hair are
portrait pigments of their own, listed below."""
from avatar_parts import CX, EYE_Y, HAIR, glasses
from kit import FIELD, INK, LACQUER, MAINNET, PAPER, PRACTICE, SILVER, WHITE, Canvas, mix, n

BOX = 256
HEAD_AT = (128, 112)  # the point the figure is scaled about
SKULL = "M78 106C78 72 100 54 128 54C156 54 178 72 178 106"
# The lower half of the face, per build: cheeks, jaw and chin.
JAWS = {
    "oval": "V124C178 153 156 172 128 172C100 172 78 153 78 124Z",
    "round": "V126C178 160 152 175 128 175C104 175 78 160 78 126Z",
    "square": "V134C178 158 160 171 128 171C96 171 78 158 78 134Z",
    "heart": "V120C178 146 148 177 128 177C108 177 78 146 78 120Z",
    "long": "V126C178 158 154 183 128 183C102 183 78 158 78 126Z",
}
LINE = "#1C1722"
BLUSH = "#F18BB7"  # chart4 rose
PAPER_TOKEN, MUTED_TOKEN = "#F5F4F8", "#ECE9F2"  # light-theme background and muted surface (packages/tokens)
# Portrait pigments. skin: (lit, shaded); hair: (mass, highlight).
SKIN = {
    "porcelain": ("#F8DCC8", "#E3B79E"),
    "light": ("#F1C7A5", "#D9A27C"),
    "tan": ("#DDA36B", "#BD8048"),
    "brown": ("#B47A4A", "#935C33"),
    "deep": ("#84512F", "#653A1F"),
}
INKS = {
    "ink": ("#1C1722", "#5A4B63"),
    "brown": ("#3F2B26", "#7A5548"),
    "auburn": ("#8A4528", "#C77B4E"),
    "silver": (SILVER["mid"], SILVER["light"]),
    "plum": ("#3A2456", "#8B6BD6"),
    "scarf": (FIELD["periwinkle"], "#A9B8F6"),
}
# The cast. scale/dy: how far the figure is enlarged about the head and moved down so headwear stays in the disc.
CAST = (
    dict(key="01-topknot", ground=FIELD["periwinkle"], skin="tan", jaw="square", nose="line", eye_dx=22, hair="topknot", ink="ink", eyes="sharp", brows="strong", mouth="smirk", robe="#1B2040", collar=MAINNET["pale"], scale=1.25, dy=24),
    dict(key="02-bob", ground=FIELD["lime"], skin="porcelain", jaw="round", nose="dot", eye_dx=23, hair="bob", ink="ink", eyes="dot", brows=None, mouth="smile", robe=BLUSH, collar=PAPER["light"], extra=("blush",), scale=1.34, dy=10),
    dict(key="03-kanzashi", ground=FIELD["pink"], skin="light", jaw="heart", nose="line", eye_dx=20, hair="updo", ink="brown", eyes="happy", brows="soft", mouth="soft", robe=PRACTICE["deep"], collar=PRACTICE["pale"], scale=1.27, dy=18),
    dict(key="04-hachimaki", ground=FIELD["orange"], skin="brown", jaw="square", nose="wide", eye_dx=22, hair="spiky", ink="auburn", eyes="wide", brows="strong", mouth="grin", robe=LACQUER["mid"], collar=FIELD["orange"], scale=1.28, dy=14),
    dict(key="05-curls", ground=FIELD["yellow"], skin="deep", jaw="oval", nose="wide", eye_dx=21, hair="curls", ink="brown", eyes="dot", brows="soft", mouth="smile", robe=MAINNET["deep"], collar="#E8EBFF", extra=("glasses",), scale=1.2, dy=18),
    dict(key="06-elder", ground="#282038", skin="light", jaw="long", nose="line", eye_dx=21, hair="elder", ink="silver", eyes="content", brows=None, mouth="none", robe=LACQUER["mid"], collar=SILVER["mid"], extra=("glasses-dark",), scale=1.3, dy=4),
    dict(key="07-buns", ground=PRACTICE["mid"], skin="porcelain", jaw="round", nose="dot", eye_dx=24, hair="buns", ink="plum", eyes="wink", brows="soft", mouth="grin", robe=PAPER_TOKEN, collar=PRACTICE["deep"], extra=("blush", "freckles"), scale=1.25, dy=20),
    dict(key="08-sweep", ground=MAINNET["pale"], skin="brown", jaw="long", nose="line", eye_dx=21, hair="sweep", ink="silver", eyes="sharp", brows="flat", mouth="flat", robe=LACQUER["shadow"], collar=MAINNET["pale"], scale=1.33, dy=8),
    dict(key="09-ponytail", ground="#5CCAD8", skin="tan", jaw="oval", nose="dot", eye_dx=22, hair="ponytail", ink="ink", eyes="wide", brows="soft", mouth="smile", robe=FIELD["orange"], collar=PAPER["light"], scale=1.26, dy=14),
    dict(key="10-scarf", ground=BLUSH, skin="brown", jaw="oval", nose="line", eye_dx=21, hair="scarf", ink="scarf", eyes="dot", brows="soft", mouth="smile", robe="#414EF4", collar=SILVER["mid"], extra=("blush",), scale=1.3, dy=10),
    dict(key="11-kasa", ground=LACQUER["mid"], skin="tan", jaw="square", nose="wide", eye_dx=22, hair="kasa", ink="ink", eyes="sharp", brows=None, mouth="smirk", robe=LACQUER["light"], collar=SILVER["mid"], scale=1.26, dy=16),
    dict(key="12-kitsune", ground=MUTED_TOKEN, skin="porcelain", jaw="heart", nose="dot", eye_dx=22, hair="fox", ink="ink", eyes="sleepy", brows=None, mouth="soft", robe=PRACTICE["deep"], collar=PAPER["light"], extra=("mole",), scale=1.25, dy=16),
)
FRECKLES = ((-34, 14), (-27, 18), (-21, 13), (21, 13), (27, 18), (34, 14))


def eye(kind: str, x: float, right: bool) -> str:
    y = EYE_Y
    if kind == "wink":
        kind = "happy" if right else "dot"
    if kind == "dot":
        return f'<circle cx="{x}" cy="{y}" r="6.4" fill="{LINE}"/><circle cx="{x - 2}" cy="{y - 2.2}" r="2" fill="{WHITE}"/>'
    if kind == "happy":
        return f'<path d="M{x - 8.5} {y + 2}Q{x} {y - 9} {x + 8.5} {y + 2}" fill="none" stroke="{LINE}" stroke-width="4.2" stroke-linecap="round"/>'
    if kind == "content":  # a short closed arc that stays clear of a glasses frame
        return f'<path d="M{x - 6} {y + 1.5}Q{x} {y - 5.5} {x + 6} {y + 1.5}" fill="none" stroke="{LINE}" stroke-width="3.8" stroke-linecap="round"/>'
    if kind == "wide":
        return (
            f'<ellipse cx="{x}" cy="{y}" rx="8.4" ry="9.4" fill="{WHITE}"/><circle cx="{x + 0.6}" cy="{y + 0.6}" r="5.6" fill="{LINE}"/>'
            f'<circle cx="{x - 1.6}" cy="{y - 2}" r="2" fill="{WHITE}"/>'
        )
    if kind == "sleepy":
        return (
            f'<path d="M{x - 8} {y}A8 8 0 0 0 {x + 8} {y}Z" fill="{LINE}"/>'
            f'<path d="M{x - 9.5} {y}H{x + 9.5}" stroke="{LINE}" stroke-width="3.4" stroke-linecap="round"/>'
        )
    tilt = -9 if right else 9  # sharp
    return f'<ellipse cx="{x}" cy="{y}" rx="8.6" ry="5" fill="{LINE}" transform="rotate({tilt} {x} {y})"/><circle cx="{x - 2.4}" cy="{y - 1.6}" r="1.6" fill="{WHITE}"/>'


def brows(kind: str, tone: str, dx: float) -> str:
    y = EYE_Y - 16
    l, r = CX - dx, CX + dx
    shapes = {
        "soft": (f"M{l - 8} {y + 1}Q{l} {y - 4} {l + 8} {y}", f"M{r - 8} {y}Q{r} {y - 4} {r + 8} {y + 1}", 3.4),
        "strong": (f"M{l - 10} {y - 3}L{l + 9} {y + 2}", f"M{r - 9} {y + 2}L{r + 10} {y - 3}", 5.2),
        "flat": (f"M{l - 9} {y}H{l + 9}", f"M{r - 9} {y}H{r + 9}", 4),
    }
    a, b, w = shapes[kind]
    return f'<path d="{a}{b}" fill="none" stroke="{tone}" stroke-width="{w}" stroke-linecap="round"/>'


def nose(kind: str, shaded: str) -> str:
    d = {
        "line": "M128 124Q123 136 131 138",
        "dot": "M125 134Q128 138 131 134",
        "wide": "M121 135Q128 141 135 135",
    }[kind]
    return f'<path d="{d}" fill="none" stroke="{shaded}" stroke-width="3" stroke-linecap="round"/>'


def mouth(kind: str) -> str:
    y = 148
    if kind == "none":
        return ""
    if kind == "grin":
        return (
            f'<path d="M{CX - 14} {y - 3}Q{CX} {y - 1} {CX + 14} {y - 3}Q{CX + 11} {y + 13} {CX} {y + 13}Q{CX - 11} {y + 13} {CX - 14} {y - 3}Z" fill="{LINE}"/>'
            f'<path d="M{CX - 11} {y - 2.4}Q{CX} {y - 0.6} {CX + 11} {y - 2.4}L{CX + 10} {y + 2.4}Q{CX} {y + 4} {CX - 10} {y + 2.4}Z" fill="{WHITE}"/>'
        )
    d = {
        "smile": f"M{CX - 12} {y - 1}Q{CX} {y + 11} {CX + 12} {y - 1}",
        "smirk": f"M{CX - 10} {y + 2}Q{CX + 2} {y + 8} {CX + 13} {y - 3}",
        "flat": f"M{CX - 9} {y + 2}H{CX + 9}",
        "soft": f"M{CX - 7} {y + 1}Q{CX} {y + 7} {CX + 7} {y + 1}",
    }[kind]
    return f'<path d="{d}" fill="none" stroke="{LINE}" stroke-width="3.8" stroke-linecap="round"/>'


def robe(c: Canvas, tone: str, collar: str, neck: str) -> str:
    """Shoulders in a kimono: left panel over right, a white under-collar at the neck."""
    cloth = c.lin([(0, mix(tone, WHITE, 0.16)), (0.6, tone), (1, mix(tone, INK, 0.3))], 0, 0, 1, 1)
    return (
        f'<path d="M20 256C24 222 52 204 94 195L128 216L162 195C204 204 232 222 236 256Z" fill="{cloth}"/>'
        f'<path d="M104 184L128 224L152 184Z" fill="{neck}"/>'
        f'<path d="M104 184L128 222L152 184L160 190L128 240L96 190Z" fill="{WHITE}"/>'
        f'<path d="M105 188L91.5 196.6L118.5 239.3L128 224.4Z" fill="{mix(collar, INK, 0.12)}"/>'
        f'<path d="M151 188L164.5 196.6L121.5 264.6L108 256Z" fill="{INK}" fill-opacity=".22" transform="translate(-3 2)"/>'
        f'<path d="M151 188L164.5 196.6L121.5 264.6L108 256Z" fill="{collar}"/>'
        f'<path d="M151 188L108 256" stroke="{INK}" stroke-opacity=".18" stroke-width="1.6"/>'
    )


def head(c: Canvas, skin: tuple[str, str], jaw: str, hide_ears: bool) -> str:
    lit, shaded = skin
    face = SKULL + JAWS[jaw]
    clip = c.clip(f'<path d="{face}"/>')
    ears = (
        ""
        if hide_ears
        else f'<ellipse cx="77" cy="124" rx="9" ry="13" fill="{lit}"/><ellipse cx="179" cy="124" rx="9" ry="13" fill="{shaded}"/>'
        f'<path d="M75 119Q79 124 76 130" fill="none" stroke="{shaded}" stroke-width="2.4" stroke-linecap="round"/>'
    )
    return (
        f'<path d="M107 150V196Q128 212 149 196V150Z" fill="{shaded}"/>'
        f'<path d="M107 180Q128 194 149 178V196Q128 212 107 196Z" fill="{lit}" fill-opacity=".55"/>'
        f"{ears}"
        f'<path d="{face}" fill="{shaded}"/>'
        f'<g clip-path="{clip}"><ellipse cx="118" cy="106" rx="60" ry="76" fill="{lit}"/></g>'
    )


def extras(names) -> tuple[str, str]:
    """(under the features, over them)."""
    under, over = "", ""
    if "blush" in names:
        under += f'<ellipse cx="96" cy="138" rx="10.5" ry="6.6" fill="{BLUSH}" fill-opacity=".5"/><ellipse cx="160" cy="138" rx="10.5" ry="6.6" fill="{BLUSH}" fill-opacity=".5"/>'
    if "freckles" in names:
        under += "".join(f'<circle cx="{CX + dx}" cy="{EYE_Y + dy}" r="1.7" fill="#B9785A" fill-opacity=".7"/>' for dx, dy in FRECKLES)
    if "mole" in names:
        under += f'<circle cx="151" cy="143" r="2.6" fill="{LINE}"/>'
    if "glasses" in names:
        over += glasses()
    if "glasses-dark" in names:
        over += glasses(LINE, 15, 4.2)
    return under, over


def avatar(spec: dict) -> tuple[str, str]:
    key = spec["key"]
    c = Canvas(f"avatar-{key}", f"Default avatar {key} (Senryo original)", BOX, BOX)
    skin = SKIN[spec["skin"]]
    hair, light = INKS[spec["ink"]]
    ground, dx = spec["ground"], spec["eye_dx"]
    glow = c.rad([(0, WHITE, 0.3), (0.6, WHITE, 0.05), (1, WHITE, 0)], 0.25, 0.18, 0.85)
    deep = c.lin([(0, INK, 0), (1, INK, 0.16)], 0, 0.4, 0.6, 1)
    c.put("ground", f'<rect width="{BOX}" height="{BOX}" fill="{ground}"/><rect width="{BOX}" height="{BOX}" fill="{glow}"/><rect width="{BOX}" height="{BOX}" fill="{deep}"/>')
    back, front = HAIR[spec["hair"]](c, hair, light)
    under, over = extras(spec.get("extra", ()))
    brow_tone = hair if spec["ink"] in ("auburn", "brown") else LINE
    face = (
        f"{nose(spec['nose'], skin[1])}{under}{eye(spec['eyes'], CX - dx, False)}{eye(spec['eyes'], CX + dx, True)}"
        f"{brows(spec['brows'], brow_tone, dx) if spec['brows'] else ''}{mouth(spec['mouth'])}"
    )
    s = spec["scale"]
    place = f"translate({HEAD_AT[0]} {HEAD_AT[1] + spec['dy']}) scale({n(s)}) translate({-HEAD_AT[0]} {-HEAD_AT[1]})"
    figure = (
        f'<g id="avatar-{key}-back">{back}</g><g id="avatar-{key}-body">{robe(c, spec["robe"], spec["collar"], skin[1])}</g>'
        f'<g id="avatar-{key}-head">{head(c, skin, spec["jaw"], spec["hair"] in ("scarf", "ponytail"))}{face}</g>'
        f'<g id="avatar-{key}-hair">{front}{over}</g>'
    )
    c.put("figure", f'<g transform="{place}">{figure}</g>')
    return f"avatar-{key}.svg", c.svg()


def build_all() -> list[tuple[str, str]]:
    return [avatar(spec) for spec in CAST]
