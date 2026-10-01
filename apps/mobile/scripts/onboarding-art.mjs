/**
 * Rasterises the onboarding scene masters (brand/art/onboarding/scene-*.svg) into one transparent WebP per top-level
 * layer, for the J1 story hero (apps/mobile/src/features/onboarding). The masters stay the source of truth: re-run
 * this after `brand/scripts/onboarding.py` changes them.
 *
 *   node apps/mobile/scripts/onboarding-art.mjs
 *
 * Needs uv (python), rsvg-convert and cwebp. Layers share the master's viewBox (756 × 940), so they register when
 * stacked; each is drawn at 1.5× (1134 × 1410), enough for a 370 pt hero on a 3× screen.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
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

const work = mkdtempSync(join(tmpdir(), "senryo-onboarding-"));
try {
  execFileSync("uv", ["run", "-q", "--with", "fonttools", "python", "onboarding.py", "--layers", work], {
    cwd: join(ROOT, "brand/scripts"),
    stdio: ["ignore", "ignore", "inherit"],
  });
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
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
  console.log(`wrote ${layers.length} layers → apps/mobile/assets/onboarding`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
