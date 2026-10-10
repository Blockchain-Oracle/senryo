/**
 * Rasterises the onboarding scene masters (brand/art/onboarding/scene-*.svg) into one transparent WebP per top-level
 * layer, for the J1 story hero (apps/mobile/src/features/onboarding). The masters stay the source of truth: re-run
 * this after `brand/scripts/onboarding.py` changes them.
 *
 *   node apps/mobile/scripts/onboarding-art.mjs
 *
 * It also writes `labels.json`: the masters carry blank label plates (a pair's name, a mode's name) that the app draws
 * as native text, so each label's box is copied from `brand/art/onboarding/labels.json` with the layer its plate is
 * on (it travels with that layer) and its ink as a theme role instead of a colour.
 *
 * The masters keep one top-level layer per unit of motion (each object, each shadow; listed back to front in
 * `brand/art/onboarding/layers.json`). The hero moves five bands (field, shadow, back, main, fore; scenes.ts), so each
 * band here is a contiguous run of those layers, which keeps the master's stacking order: `BANDS` names the layer each
 * band starts at, and everything between the field and the first named band is the shadow band.
 *
 * Needs uv (python), rsvg-convert and cwebp. Layers share the master's viewBox (756 × 940), so they register when
 * stacked; each is drawn at 1.5× (1134 × 1410), enough for a 370 pt hero on a 3× screen.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = join(ROOT, "apps/mobile/assets/onboarding");
const WIDTH = 1134;
const HEIGHT = 1410;
const QUALITY = 88;
const ALPHA_QUALITY = 90;
const LAYER = /^scene-[a-z]+-(field|shadow|back|main|fore)\.svg$/;
/**
 * The masters' label inks are the light theme's text colours (the plates are light in both themes): kit.py's PRACTICE
 * and MAINNET deep are LIGHT.practice and LIGHT.mainnet.
 */
const INK_ROLE = { "#666666": "paperPractice", "#000000": "paperMainnet" };
/** Per scene, the master layer each band starts at (layers.json ids without the scene prefix). */
// Only the scenes the story shows (scenes.ts); the retired masters (balance, markets, kinpaku) stay in brand/art.
const BANDS = {
  call: { back: "tablet", main: "down", fore: "glints" },
  payout: { back: "chest", main: "coin-high", fore: "glints" },
  passkey: { back: "tablet", main: "tag-shadow", fore: "glints" },
  lp: { back: "door", main: "well", fore: "drop" },
  modes: { back: "mainnet", main: "bundle", fore: "note-shadow" },
};
/** Writes `scene-<key>-<band>.svg` into `out` from the per-layer files `onboarding.py --layers` wrote into `split`. */
function writeBands(split, out) {
  const { masters } = JSON.parse(readFileSync(join(ROOT, "brand/art/onboarding/layers.json"), "utf8"));
  for (const [key, starts] of Object.entries(BANDS)) {
    const scene = `scene-${key}`;
    const ids = masters[scene].layers.map((layer) => layer.id);
    if (ids[0] !== `${scene}-field`) throw new Error(`${scene}: the first layer is not the field`);
    const bands = [
      ["field", 0],
      ["shadow", 1],
    ];
    for (const band of ["back", "main", "fore"]) {
      if (!starts[band]) continue;
      const at = ids.indexOf(`${scene}-${starts[band]}`);
      if (at < bands.at(-1)[1]) throw new Error(`${scene}: no layer ${starts[band]} after the ${bands.at(-1)[0]} band`);
      bands.push([band, at]);
    }
    let head = "";
    const groups = ids.map((id) => {
      const svg = readFileSync(join(split, `${id}.svg`), "utf8");
      head = svg.slice(0, svg.indexOf("<g id="));
      return svg.slice(head.length, svg.lastIndexOf("</svg>")).trim();
    });
    bands.forEach(([band, from], i) => {
      const to = bands[i + 1]?.[1] ?? ids.length;
      const body = groups.slice(from, to).join("\n  ");
      if (from < to) writeFileSync(join(out, `${scene}-${band}.svg`), `${head}${body}\n</svg>\n`);
    });
  }
}

const work = mkdtempSync(join(tmpdir(), "senryo-onboarding-"));
try {
  const split = join(work, "layers");
  execFileSync("uv", ["run", "-q", "--no-project", "--python", "3.12", "--with", "fonttools", "python", "onboarding.py", "--layers", split], {
    cwd: join(ROOT, "brand/scripts"),
    stdio: ["ignore", "ignore", "inherit"],
  });
  writeBands(split, work);
  // Only the scene layers are this script's: other files in the folder (the welcome sky) are left alone.
  mkdirSync(OUT, { recursive: true });
  for (const name of readdirSync(OUT)) if (/^scene-.*\.webp$/.test(name)) rmSync(join(OUT, name));
  const layers = readdirSync(work).filter((name) => LAYER.test(name));
  for (const name of layers) {
    const png = join(work, name.replace(".svg", ".png"));
    execFileSync("rsvg-convert", ["-w", String(WIDTH), "-h", String(HEIGHT), "-o", png, join(work, name)]);
    execFileSync("cwebp", [
      "-quiet",
      "-q",
      String(QUALITY),
      "-alpha_q",
      String(ALPHA_QUALITY),
      png,
      "-o",
      join(OUT, name.replace(".svg", ".webp")),
    ]);
  }
  const master = JSON.parse(readFileSync(join(ROOT, "brand/art/onboarding/labels.json"), "utf8"));
  const scenes = {};
  for (const [scene, labels] of Object.entries(master.labels)) {
    if (!(scene.replace("scene-", "") in BANDS)) continue;
    scenes[scene.replace("scene-", "")] = labels.map((label) => {
      const layer = layers.find(
        (name) => name.startsWith(`${scene}-`) && readFileSync(join(work, name), "utf8").includes(`id="${label.id}"`),
      );
      const ink = INK_ROLE[label.ink];
      if (!layer || !ink) throw new Error(`label ${label.id}: no layer or unknown ink ${label.ink}`);
      const { text, x, y, width, height } = label;
      return { text, x, y, width, height, ink, layer: layer.replace(`${scene}-`, "").replace(".svg", "") };
    });
  }
  writeFileSync(join(OUT, "labels.json"), `${JSON.stringify({ viewBox: master.viewBox, scenes }, null, 2)}\n`);
  console.log(`wrote ${layers.length} layers and labels.json → apps/mobile/assets/onboarding`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
