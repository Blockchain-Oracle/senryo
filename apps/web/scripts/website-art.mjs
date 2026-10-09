/**
 * Renders the story scene masters (brand/art/onboarding/scene-*.svg, the phone's story art) into one flat WebP each for
 * the landing (apps/web/public/brand/website/scene-*.webp). The masters stay the source of truth: re-run after
 * `brand/scripts/onboarding.py` changes them.
 *
 *   node apps/web/scripts/website-art.mjs
 *
 * Needs rsvg-convert and cwebp (as apps/mobile/scripts/onboarding-art.mjs). 756 × 940 masters drawn at 1×: the landing
 * shows them at most ~380 CSS px wide, so 2× there. The masters' label plates are blank (the phone draws the names as
 * text, `StoryHero`); here each name from `labels.json` is printed into its plate the same way — centred, bold, at
 * 0.44 of the plate's height, in its ink.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = join(ROOT, "brand/art/onboarding");
const OUT = join(ROOT, "apps/web/public/brand/website");
const WIDTH = 756;
const HEIGHT = 940;
const QUALITY = 86;
/** The scenes the landing tells: the call, the payout, the passkey, Practice and Real. */
const SCENES = ["call", "payout", "passkey", "modes"];
const LABEL_FONT_RATIO = 0.44;
const LABELS = JSON.parse(readFileSync(join(SRC, "labels.json"), "utf8")).labels;
const escapeXml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The master with its plates' names printed in. */
function labelled(scene) {
  const svg = readFileSync(join(SRC, `scene-${scene}.svg`), "utf8");
  const texts = (LABELS[`scene-${scene}`] ?? [])
    .map(
      (l) =>
        `<text x="${l.x + l.width / 2}" y="${l.y + l.height / 2}" text-anchor="middle" dominant-baseline="central" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="700" font-size="${(l.height * LABEL_FONT_RATIO).toFixed(1)}" fill="${l.ink}">${escapeXml(l.text)}</text>`,
    )
    .join("");
  return svg.replace("</svg>", `${texts}</svg>`);
}

const tmp = mkdtempSync(join(tmpdir(), "website-art-"));
try {
  for (const scene of SCENES) {
    const png = join(tmp, `${scene}.png`);
    const svg = join(tmp, `${scene}.svg`);
    writeFileSync(svg, labelled(scene));
    execFileSync("rsvg-convert", ["-w", String(WIDTH), "-h", String(HEIGHT), "-o", png, svg]);
    execFileSync("cwebp", ["-quiet", "-q", String(QUALITY), png, "-o", join(OUT, `scene-${scene}.webp`)]);
    console.warn(`website-art: scene-${scene}.webp`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
