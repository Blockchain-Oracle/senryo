"""Writes the authored J1 artwork masters (S1b.3, pending design review — B12): six onboarding scenes, the
pending-passkey art, the completion foil, the two permission-primer heroes (S1b.13) and the twelve default avatars.
Deterministic: same input, same bytes.

  python3 brand/scripts/onboarding.py                 # brand/art/onboarding/*.svg, brand/art/avatars/*.svg
  python3 brand/scripts/onboarding.py --layers <dir>  # also one SVG per top-level layer, for Skia/Reanimated work

`brand/art/onboarding/labels.json` lists the plates the app fills with native text (FX pair names, mode names).
`brand/art/onboarding/layers.json` lists every master's layers, back to front, with role, depth, subject, what
moves most and, where a layer swings or lifts, the point it moves about.

Each master's top-level groups are its layers, one per unit of motion (`<key>-field` first, then each object and each
object's shadow, back to front). `--layers` splits them into stand-alone files that share the master's viewBox and
defs, so a layer can be rasterised and animated on its own and still register with the others.
"""
import json
import os
import re
import sys

import avatars
import foil
import pending
import primer_bell
import primer_lock
import scene_balance
import scene_kinpaku
import scene_lp
import scene_markets
import scene_modes
import scene_passkey
from kit import ART, LABELS, MANIFEST, ROOT, SCENE_H, SCENE_W, write

SCENES = (scene_balance, scene_passkey, scene_markets, scene_lp, scene_kinpaku, scene_modes)
EXTRAS = (pending, foil, primer_bell, primer_lock)


def masters() -> list[tuple[str, str, str]]:
    """(folder, file name, svg) for every master."""
    out = [("onboarding", *module.build()) for module in (*SCENES, *EXTRAS)]
    out += [("avatars", name, body) for name, body in avatars.build_all()]
    return out


def split_layers(name: str, body: str, out_dir: str) -> None:
    head = body[: body.index("<g id=")]
    for match in re.finditer(r'  <g id="([^"]+)">.*', body):
        with open(os.path.join(out_dir, f"{match.group(1)}.svg"), "w") as f:
            f.write(f"{head}{match.group(0).strip()}\n</svg>\n")


def main() -> None:
    layers = sys.argv[sys.argv.index("--layers") + 1] if "--layers" in sys.argv else None
    if layers:
        os.makedirs(layers, exist_ok=True)
    for folder, name, body in masters():
        print("wrote", write(folder, name, body))
        if layers:
            split_layers(name, body, layers)
    # Where the app draws native text over a master (pair names, mode names): never outlined into the artwork, so it
    # stays localisable and readable by assistive technology. Boxes are in master units.
    anchors = {"viewBox": [SCENE_W, SCENE_H], "labels": dict(sorted(LABELS.items()))}
    write_json("labels.json", anchors)
    # The layers of every master, back to front, for whoever animates them: one layer per unit of motion. `role` is
    # field, shadow (`of` names its object), ground, object or accent. `depth` is relative travel: 0 stays still, 1
    # travels most, equal depths move together. `subject` is what the scene is about; `mostMotion` what moves most;
    # `pivots` (master units) the point a swinging or lifting layer turns about.
    layers = {}
    for module in (*SCENES, *EXTRAS):
        key = module.KEY
        pivots = getattr(module, "PIVOTS", {})
        layers[key] = {
            "subject": f"{key}-{module.MOTION['subject']}",
            "mostMotion": [f"{key}-{name}" for name in module.MOTION["mostMotion"]],
            "layers": MANIFEST[key],
        } | ({"pivots": {f"{key}-{name}": [round(x, 1), round(y, 1)] for name, (x, y) in pivots.items()}} if pivots else {})
    write_json("layers.json", {"masters": layers})


def write_json(name: str, data: dict) -> None:
    path = os.path.join(ART, "onboarding", name)
    with open(path, "w") as f:
        f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
