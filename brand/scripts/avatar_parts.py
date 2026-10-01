"""Hair, headwear and accessories for the twelve default avatars. Every part is drawn in the avatar's 256 box around
one shared head (kit of parts, one family). A part returns (behind the head, in front of the face)."""
import math

from kit import INK, PRACTICE, SILVER, WHITE, n, pts

HEAD_TOP, EAR_Y, EYE_Y, EYE_DX, CX = 54, 122, 118, 21, 128
STRAW = ("#F0E2B4", "#D8C489", "#A08A52")
MASK = ("#FBF8F1", "#DDD6C6")


def cap(c, hair: str, lift: float = 0.0, hairline: float = 76.0) -> str:
    """The hair mass over the skull, down to a hairline that dips at the temples."""
    top = 44 - lift
    return (
        f'<path d="M75 106C72 {n(top + 24)} 98 {n(top)} 128 {n(top)}C158 {n(top)} 184 {n(top + 24)} 181 106'
        f'C176 {n(hairline + 10)} 158 {n(hairline)} 128 {n(hairline)}C98 {n(hairline)} 80 {n(hairline + 10)} 75 106Z" fill="{hair}"/>'
    )


def shine(light: str, d: str, width: float = 5, opacity: float = 0.5) -> str:
    return f'<path d="{d}" fill="none" stroke="{light}" stroke-opacity="{n(opacity)}" stroke-width="{n(width)}" stroke-linecap="round"/>'


def topknot(c, hair: str, light: str):
    front = (
        f'<ellipse cx="128" cy="30" rx="17" ry="14" fill="{hair}"/>'
        f'<path d="M116 40H140V50H116Z" fill="{PRACTICE["deep"]}"/><path d="M116 40H140V43.5H116Z" fill="{PRACTICE["mid"]}"/>'
        f"{cap(c, hair, 0, 80)}"
        f'<path d="M75 104C74 112 75 120 78 126L82 100ZM181 104C182 112 181 120 178 126L174 100Z" fill="{hair}"/>'
        f"{shine(light, 'M92 76C100 62 114 54 130 53')}{shine(light, 'M121 26C125 22 131 21 136 23', 3.4)}"
    )
    return "", front


def bob(c, hair: str, light: str):
    back = (
        f'<path d="M62 114C60 62 92 36 128 36C164 36 196 62 194 114V156C194 172 180 178 166 174V112H90V174'
        f'C76 178 62 172 62 156Z" fill="{hair}"/>'
    )
    front = (
        f'<path d="M76 104C74 66 98 44 128 44C158 44 182 66 180 104V100C160 96 96 96 76 100Z" fill="{hair}"/>'
        f"{shine(light, 'M90 80C102 62 122 54 146 56', 6)}"
    )
    return back, front


def updo(c, hair: str, light: str):
    back = f'<circle cx="134" cy="42" r="23" fill="{hair}"/>'
    front = (
        f'<path d="M75 108C73 68 98 46 128 46C158 46 183 68 181 108C176 90 158 70 130 62C104 70 82 90 75 108Z" fill="{hair}"/>'
        f'<path d="M128 56L166 40" stroke="{SILVER["shadow"]}" stroke-width="7" stroke-linecap="round"/>'
        f'<path d="M128 55L166 39" stroke="{SILVER["light"]}" stroke-width="3.4" stroke-linecap="round"/>'
        f'<circle cx="168" cy="38" r="11" fill="{PRACTICE["deep"]}"/><circle cx="165" cy="35" r="3.6" fill="{PRACTICE["pale"]}"/>'
        f'<path d="M168 49V60" stroke="{SILVER["mid"]}" stroke-width="2.6"/><circle cx="168" cy="65" r="6.5" fill="{PRACTICE["mid"]}"/>'
        f"{shine(light, 'M90 82C100 68 114 60 128 58')}{shine(light, 'M122 30C128 24 138 22 146 26', 3.6)}"
    )
    return back, front


def spiky(c, hair: str, light: str):
    spikes = [(75, 106), (68, 78), (84, 84), (80, 52), (100, 68), (104, 34), (120, 58), (134, 28), (144, 58), (162, 36), (162, 68), (182, 54), (174, 84), (190, 80), (181, 106)]
    front = (
        f'<path d="{pts(spikes)[:-1]}C174 88 156 80 128 80C100 80 82 88 75 106Z" fill="{hair}" stroke="{hair}" stroke-width="5" stroke-linejoin="round"/>'
        f"{shine(light, 'M104 44L112 66', 4)}{shine(light, 'M134 38L138 62', 4)}{shine(light, 'M160 46L156 68', 4)}"
        # hachimaki: a white band knotted at the side
        f'<path d="M76 92C92 82 164 82 180 92V104C164 95 92 95 76 104Z" fill="{WHITE}"/>'
        f'<path d="M76 101C92 92 164 92 180 101V104C164 95 92 95 76 104Z" fill="{SILVER["mid"]}"/>'
        f'<path d="M180 94L200 84L198 98ZM180 98L204 106L192 114Z" fill="{WHITE}"/><circle cx="181" cy="97" r="5" fill="{SILVER["mid"]}"/>'
        f'<circle cx="128" cy="92" r="5" fill="{PRACTICE["deep"]}"/>'
    )
    return "", front


def curls(c, hair: str, light: str):
    ring = [(128 + 60 * math.cos(math.radians(a)), 86 + 56 * math.sin(math.radians(a))) for a in range(150, 391, 24)]
    back = f'<ellipse cx="128" cy="90" rx="62" ry="58" fill="{hair}"/>' + "".join(f'<circle cx="{n(x)}" cy="{n(y)}" r="21" fill="{hair}"/>' for x, y in ring)
    brow = [(86 + i * 14, 70 - 6 * math.sin(math.pi * i / 6)) for i in range(7)]
    front = (
        "".join(f'<circle cx="{n(x)}" cy="{n(y)}" r="12.5" fill="{hair}"/>' for x, y in brow)
        + "".join(shine(light, f"M{n(x - 9)} {n(y - 4)}A11 11 0 0 1 {n(x + 5)} {n(y - 11)}", 3.2, 0.45) for x, y in ring[2:8])
    )
    return back, front


def elder(c, hair: str, light: str):
    front = (
        f'<path d="M72 96C66 104 68 126 76 132C80 120 80 106 78 96ZM184 96C190 104 188 126 180 132C176 120 176 106 178 96Z" fill="{hair}"/>'
        f'<path d="M82 134C80 150 86 160 92 164C90 176 108 196 128 198C148 196 166 176 164 164C170 160 176 150 174 134'
        f'C168 150 154 154 142 150C136 148 132 146 128 146C124 146 120 148 114 150C102 154 88 150 82 134Z" fill="{hair}"/>'
        f'<path d="M128 140C118 136 106 140 100 148C110 150 122 148 128 144C134 148 146 150 156 148C150 140 138 136 128 140Z" fill="{light}"/>'
        f'<path d="M112 166Q128 174 144 166M128 176V190" fill="none" stroke="{SILVER["shadow"]}" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>'
        f"{shine(light, 'M100 172C108 182 118 186 128 186', 4, 0.7)}"
    )
    return "", front


def buns(c, hair: str, light: str):
    back = f'<circle cx="82" cy="48" r="22" fill="{hair}"/><circle cx="174" cy="48" r="22" fill="{hair}"/>'
    front = (
        f"{cap(c, hair, 0, 74)}"
        f'<path d="M76 104C78 84 96 70 128 70C160 70 178 84 180 104C170 94 160 92 150 96C144 90 134 90 128 96C120 90 110 90 104 96C96 92 86 94 76 104Z" fill="{hair}"/>'
        f'<path d="M92 56H72M184 56H164" stroke="{PRACTICE["mid"]}" stroke-width="5" stroke-linecap="round"/>'
        f"{shine(light, 'M70 42A16 16 0 0 1 88 32', 3.6)}{shine(light, 'M162 42A16 16 0 0 1 180 32', 3.6)}{shine(light, 'M96 70C106 60 118 56 132 56')}"
    )
    return back, front


def sweep(c, hair: str, light: str):
    front = (
        f'<path d="M75 108C76 96 78 88 82 82L84 110ZM181 108C180 96 178 88 174 82L172 110Z" fill="{hair}" fill-opacity=".55"/>'
        f'<path d="M80 92C70 60 96 30 138 34C172 36 192 60 182 92C178 78 166 70 150 72C126 74 102 80 80 92Z" fill="{hair}"/>'
        f"{shine(light, 'M94 70C104 52 124 44 148 46', 6)}{shine(light, 'M110 76C124 66 144 62 162 66', 3.4, 0.4)}"
        f'<circle cx="75" cy="141" r="8.5" fill="none" stroke="{SILVER["light"]}" stroke-width="4"/>'
    )
    return "", front


def ponytail(c, hair: str, light: str):
    back = (
        f'<path d="M158 52C204 30 232 74 214 124C208 146 196 160 184 168C196 140 196 106 176 86Z" fill="{hair}"/>'
        f"{shine(light, 'M190 62C208 76 212 100 204 124', 5, 0.45)}"
    )
    lac = "#2B2331"
    front = (
        f"{cap(c, hair, 0, 70)}{shine(light, 'M92 76C102 62 116 56 132 55')}"
        f'<circle cx="164" cy="56" r="8" fill="{PRACTICE["mid"]}"/>'
        f'<path d="M70 118C66 62 96 32 128 32C160 32 190 62 186 118" fill="none" stroke="{lac}" stroke-width="9" stroke-linecap="round"/>'
        f'<path d="M72 104C70 68 96 40 128 39" fill="none" stroke="{WHITE}" stroke-opacity=".25" stroke-width="2.4" stroke-linecap="round"/>'
        f'<rect x="58" y="102" width="22" height="40" rx="10" fill="{lac}"/><rect x="176" y="102" width="22" height="40" rx="10" fill="{lac}"/>'
        f'<rect x="61" y="108" width="6" height="28" rx="3" fill="{SILVER["mid"]}"/><rect x="189" y="108" width="6" height="28" rx="3" fill="{SILVER["mid"]}"/>'
    )
    return back, front


def scarf(c, hair: str, light: str):
    wrap = "M60 128C56 68 92 34 128 34C164 34 200 68 196 128C196 170 182 200 164 214H92C74 200 60 170 60 128Z"
    face_hole = "M86 112C86 82 104 66 128 66C152 66 170 82 170 112V126C170 150 152 166 128 166C104 166 86 150 86 126Z"
    back = f'<path d="{wrap}" fill="{hair}"/>'
    front = (
        f'<path d="{wrap}{face_hole}" fill-rule="evenodd" fill="{hair}"/>'
        f'<path d="M88 100C92 78 108 68 128 68C148 68 164 78 168 100C156 84 142 78 128 78C114 78 100 84 88 100Z" fill="{light}"/>'
        f'<path d="M172 96C184 120 182 160 160 196M84 96C72 120 76 164 98 200M96 176C112 190 144 190 160 176" fill="none" stroke="{INK}" '
        f'stroke-opacity=".16" stroke-width="3" stroke-linecap="round"/>'
        f"{shine(light, 'M78 86C86 58 106 44 130 43', 6, 0.55)}"
    )
    return back, front


def kasa(c, hair: str, light: str):
    back = f'<path d="M76 100V128H84V100ZM180 100V128H172V100Z" fill="{hair}"/>'
    apex, rim_y, half, sag = 26, 84, 96, 18  # a low cone: apex height, brim height, half width, how far the brim sags
    ribs = "".join(
        f'<path d="M128 {apex}L{n(128 + half * k)} {n(rim_y + sag * (1 - k * k) * 0.5)}" stroke="{STRAW[2]}" stroke-opacity=".6" stroke-width="2.4"/>'
        for k in (-0.66, 0, 0.66)
    )
    rings = "".join(
        f'<path d="M{n(128 - half * k)} {n(apex + (rim_y - apex) * k)}Q128 {n(apex + (rim_y - apex) * k + sag * k)} {n(128 + half * k)} {n(apex + (rim_y - apex) * k)}" '
        f'fill="none" stroke="{STRAW[2]}" stroke-opacity=".55" stroke-width="2.2"/>'
        for k in (0.55,)
    )
    brim = f"M{128 - half} {rim_y}Q128 {rim_y + sag} {128 + half} {rim_y}"
    front = (
        f'<path d="M84 {rim_y + 5}Q128 {rim_y + 13} 172 {rim_y + 5}V{rim_y + 14}Q128 {rim_y + 19} 84 {rim_y + 14}Z" fill="{INK}" fill-opacity=".24"/>'
        f'<path d="M82 104L98 172M174 104L158 172" stroke="{PRACTICE["mid"]}" stroke-opacity=".7" stroke-width="2.6" stroke-linecap="round"/>'
        f'<path d="M{128 - half} {rim_y}L128 {apex}L{128 + half} {rim_y}Q128 {rim_y + sag} {128 - half} {rim_y}Z" fill="{STRAW[1]}"/>'
        f'<path d="M{128 - half} {rim_y}L128 {apex}V{rim_y + sag / 2}Q70 {rim_y + sag / 2} {128 - half} {rim_y}Z" fill="{STRAW[0]}" fill-opacity=".7"/>{ribs}{rings}'
        f'<path d="{brim}" fill="none" stroke="{STRAW[2]}" stroke-width="3.4" stroke-linecap="round"/>'
        f'<circle cx="128" cy="{apex}" r="5" fill="{STRAW[2]}"/>'
    )
    return back, front


def fox_mask(c, hair: str, light: str):
    back = f'<path d="M62 116C60 62 92 36 128 36C164 36 196 62 194 116V250H62Z" fill="{hair}"/>{shine(light, "M184 130V226", 5, 0.3)}'
    ink = PRACTICE["deep"]
    mask = (
        f'<g transform="translate(92 70) rotate(-22) scale(.88)">'
        f'<path d="M-30 -18L-22 -46L-6 -26Q0 -28 6 -26L22 -46L30 -18Q34 6 14 24Q6 32 0 34Q-6 32 -14 24Q-34 6 -30 -18Z" fill="{MASK[1]}" transform="translate(2 3)"/>'
        f'<path d="M-30 -18L-22 -46L-6 -26Q0 -28 6 -26L22 -46L30 -18Q34 6 14 24Q6 32 0 34Q-6 32 -14 24Q-34 6 -30 -18Z" fill="{MASK[0]}" stroke="#BDB3A0" stroke-width="2" stroke-linejoin="round"/>'
        f'<path d="M-23 -24L-21 -38L-12 -27ZM23 -24L21 -38L12 -27Z" fill="{ink}"/>'
        f'<path d="M-21 -5Q-12 -13 -5 -3M21 -5Q12 -13 5 -3" fill="none" stroke="{INK}" stroke-width="4.4" stroke-linecap="round"/>'
        f'<path d="M-4 22L0 29L4 22Z" fill="{INK}"/>'
        "</g>"
    )
    front = (
        f'<path d="M76 106C74 66 98 44 128 44C158 44 182 66 180 106V102C160 98 96 98 76 102Z" fill="{hair}"/>'
        f"{shine(light, 'M100 70C112 58 128 54 148 56', 6)}"
        f'<path d="M110 40C140 30 172 44 186 76" fill="none" stroke="{PRACTICE["mid"]}" stroke-width="3" stroke-linecap="round"/>{mask}'
    )
    return back, front


def glasses(tone: str = SILVER["mid"], r: float = 15.5, weight: float = 4.6) -> str:
    return (
        f'<g fill="{WHITE}" fill-opacity=".2" stroke="{tone}" stroke-width="{n(weight)}">'
        f'<circle cx="{CX - EYE_DX - 1}" cy="{EYE_Y}" r="{n(r)}"/><circle cx="{CX + EYE_DX + 1}" cy="{EYE_Y}" r="{n(r)}"/></g>'
        f'<path d="M{n(CX - EYE_DX - 1 + r)} {EYE_Y - 2}Q{CX} {EYE_Y - 8} {n(CX + EYE_DX + 1 - r)} {EYE_Y - 2}" fill="none" stroke="{tone}" stroke-width="{n(weight)}"/>'
    )


HAIR = {
    "topknot": topknot, "bob": bob, "updo": updo, "spiky": spiky, "curls": curls, "elder": elder,
    "buns": buns, "sweep": sweep, "ponytail": ponytail, "scarf": scarf, "kasa": kasa, "fox": fox_mask,
}  # fmt: skip
