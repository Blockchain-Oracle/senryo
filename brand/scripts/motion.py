"""Representative motion samples for the J1 art review (B12). Review aids only: written to brand/review/ (gitignored).

  python3 brand/scripts/motion.py     # needs rsvg-convert, ImageMagick 7 (`magick`) and ffmpeg

Three short samples, each driven only by moving the masters' layers (a transform and an opacity per top-level group,
per frame), which is what the Skia/Reanimated implementation will do with the rasterised layers. They show that the layers come apart cleanly and
where the motion grammar of direction §4 lands on this art; they are not the implementation and prove no device
performance. Timings: scene travel ≈ 850 ms, completion foil reveal ≈ 800 ms, then slow ambient movement.

- j1-motion-passkey.mp4: scene 2 arrives in layers; the key settles onto its bed; its shadow closes under it.
- j1-motion-lp.mp4: the drop falls, the surface is disturbed, the ripples spread and fade.
- j1-motion-foil.mp4: the leaf arrives, the highlight crosses the pressed seal, the flakes drift.
Each also gets a -strip.png (eight frames side by side) for a still record.
"""
import math
import os
import re
import shutil
import subprocess

from art import BRAND, ROOT

REVIEW = os.path.join(BRAND, "review")
ART = os.path.join(BRAND, "art", "onboarding")
FPS = 30
WIDTH = 378  # rendered at the hero's 1x width
STRIP_FRAMES = 8
GROUND = "#111111"


def ease(t: float) -> float:
    """The house deceleration (direction §4: cubic-bezier(0.2, 0.8, 0.2, 1)), as a close closed form."""
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3.2


def span(t: float, start: float, length: float) -> float:
    """Progress 0..1 of a move that starts at `start` seconds and lasts `length`."""
    return min(max((t - start) / length, 0.0), 1.0)


def group_end(svg: str, start: int) -> int:
    """Index just past the </g> that closes the <g …> opening at `start`."""
    depth = 0
    for match in re.finditer(r"<g\b|</g>", svg[start:]):
        depth += 1 if match.group(0) == "<g" else -1
        if depth == 0:
            return start + match.end()
    raise ValueError("unclosed group")


def move(svg: str, moves: dict[str, tuple[str, float]]) -> str:
    """Wraps each named group in a group carrying this frame's transform and opacity."""
    for name, (transform, opacity) in moves.items():
        start = svg.index(f'<g id="{name}"')
        end = group_end(svg, start)
        svg = f'{svg[:start]}<g transform="{transform}" opacity="{opacity:.3f}">{svg[start:end]}</g>{svg[end:]}'
    return svg


def about(x: float, y: float, inner: str) -> str:
    """A transform applied about a point."""
    return f"translate({x:.2f} {y:.2f}) {inner} translate({-x:.2f} {-y:.2f})"


def passkey(t: float) -> dict[str, tuple[str, float]]:
    k = "scene-passkey"
    slab, phone, key = ease(span(t, 0.0, 0.85)), ease(span(t, 0.12, 0.85)), ease(span(t, 0.3, 0.9))
    sway = math.sin(math.tau * t / 6) * 2.2  # the tag keeps swinging: one slow ambient loop
    lift = 1 - key
    return {
        f"{k}-tablet": (f"translate({(1 - slab) * 70:.2f} {(1 - slab) * 24:.2f})", slab),
        f"{k}-tablet-shadow": (f"translate({(1 - slab) * 70:.2f} {(1 - slab) * 24:.2f})", slab),
        f"{k}-phone": (f"translate({(1 - phone) * 120:.2f} {(1 - phone) * -30:.2f})", phone),
        f"{k}-phone-shadow": (f"translate({(1 - phone) * 120:.2f} {(1 - phone) * -30:.2f})", phone),
        f"{k}-key": (f"translate({lift * -70:.2f} {lift * -96:.2f}) " + about(300, 500, f"rotate({lift * -9:.2f})"), min(key * 1.6, 1)),
        f"{k}-key-shadow": (f"translate({lift * -20:.2f} {lift * -26:.2f})", key * key),
        f"{k}-tag": (about(140, 700, f"rotate({sway + lift * 10:.2f})"), min(key * 1.6, 1)),
        f"{k}-tag-shadow": (about(140, 700, f"rotate({sway + lift * 10:.2f})"), key),
        f"{k}-cord": (about(170, 680, f"rotate({sway * 0.5:.2f})"), min(key * 1.6, 1)),
        f"{k}-glints": ("translate(0 0)", 0.35 + 0.65 * (0.5 + 0.5 * math.sin(math.tau * t / 2.4)) * span(t, 1.0, 0.4)),
    }


def lp(t: float) -> dict[str, tuple[str, float]]:
    k = "scene-lp"
    cycle = t % 2.4
    fall = min(cycle / 0.55, 1.0) ** 2  # the drop accelerates
    landed = span(cycle, 0.55, 1.6)
    spread = 0.25 + 0.75 * ease(landed)
    ix, iy = 380, 642  # the impact point in the master
    return {
        f"{k}-drop": (f"translate(0 {-190 + fall * 228:.2f})", 1.0 if cycle < 0.55 else 0.0),
        f"{k}-ripples": (about(ix, iy, f"scale({spread:.3f})"), 0.0 if cycle < 0.55 else (1 - landed) ** 0.8),
        f"{k}-door": (about(372, 470, f"rotate({math.sin(math.tau * t / 8) * 0.5:.2f})"), 1.0),
    }


def foil(t: float) -> dict[str, tuple[str, float]]:
    k = "completion-foil"
    arrive = ease(span(t, 0.0, 0.8))
    cross = span(t, 0.35, 0.9)
    breathe = 0.5 + 0.5 * math.sin(math.tau * t / 7)
    place = about(300, 330, f"scale({0.9 + 0.1 * arrive:.3f}) rotate({(1 - arrive) * -5:.2f})")
    return {
        f"{k}-shadow": (place, arrive),
        f"{k}-leaf": (place, arrive),
        f"{k}-seal": (place, arrive),
        f"{k}-sheen": (place, (math.sin(math.pi * cross) * 0.85 + 0.15 * breathe) * arrive),
        f"{k}-flakes": (f"translate({t * 5:.2f} {-t * 7 + (1 - arrive) * 24:.2f})", arrive),
    }


SAMPLES = (("passkey", "scene-passkey.svg", passkey, 2.4), ("lp", "scene-lp.svg", lp, 2.4), ("foil", "completion-foil.svg", foil, 2.4))


def render(name: str, master: str, motion, seconds: float) -> None:
    with open(os.path.join(ART, master)) as f:
        svg = f.read()
    frames = os.path.join(REVIEW, f".motion-{name}")
    os.makedirs(frames, exist_ok=True)
    count = round(seconds * FPS)
    for i in range(count):
        frame = os.path.join(frames, f"{i:03d}")
        with open(f"{frame}.svg", "w") as f:
            f.write(move(svg, motion(i / FPS)))
        subprocess.run(["rsvg-convert", "-w", str(WIDTH), "-b", GROUND, "-o", f"{frame}.png", f"{frame}.svg"], check=True)
    out = os.path.join(REVIEW, f"j1-motion-{name}")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(frames, "%03d.png"),
         "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p", f"{out}.mp4"],
        check=True,
    )  # fmt: skip
    picks = [os.path.join(frames, f"{round(i * (count - 1) / (STRIP_FRAMES - 1)):03d}.png") for i in range(STRIP_FRAMES)]
    subprocess.run(["magick", *picks, "-background", GROUND, "-splice", "8x0", "+append", f"{out}-strip.png"], check=True)
    shutil.rmtree(frames)
    print("wrote", os.path.relpath(f"{out}.mp4", ROOT))


def main() -> None:
    os.makedirs(REVIEW, exist_ok=True)
    for sample in SAMPLES:
        render(*sample)


if __name__ == "__main__":
    main()
