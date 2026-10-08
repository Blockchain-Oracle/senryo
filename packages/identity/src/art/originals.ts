/**
 * Senryo's own marks and the original identity art (v2 direction §10, S1b.3 first pass). Authored in code by
 * `brand/scripts/build.py` (seal) and `brand/scripts/art.py` (koban, chōgin, FX pair discs, venue chip); the user's
 * design agent reviews and may replace any file (B12 stays open until that review passes). Re-hash with
 * `pnpm --filter @senryo/identity codegen --rehash` after re-rendering (Senryo originals only).
 */
import type { ArtSource } from "../types.ts";

const AUTHORED = "2026-09-30";
const SEAL_LICENCE =
  "Senryo's own mark. The 千 is Zen Old Mincho Black outlined to paths under the SIL Open Font License 1.1 " +
  "(outlining glyphs into artwork is permitted; brand/README.md 'Fonts and licences').";
const ORIGINAL_LICENCE =
  "Senryo original artwork (brand/scripts/art.py). Materials from the Living Lacquer ramps (v2-plan §5.2); the 千 is " +
  "the seal's outlined glyph (SIL OFL 1.1). First-pass master pending design review (B12).";
const FX_LICENCE =
  "Senryo original composition (brand/scripts/art.py): two public-domain flags (Wikimedia Commons originals, see " +
  "src/art/flags.ts) scaled uniformly and cropped by overlapping discs. First-pass master pending design review (B12).";

/** An FX pair disc: base-currency flag disc overlapped by the US-dollar disc; the pair text is always shown beside it. */
function fxPair(key: string, flag: string, sha256: string): ArtSource {
  return {
    key,
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/scripts/art.py",
    licence: FX_LICENCE,
    retrieved: AUTHORED,
    usage: "Always with the pair text (EUR/USD …) beside it; flag-use notices in src/art/flags.ts apply.",
    derivedFrom: [flag, "flag-us"],
    variants: {
      disc: {
        path: `brand/art/${key}.svg`,
        url: `brand/art/${key}.svg`,
        sha256,
        viewBox: "0 0 256 256",
        insetPermille: 0,
        surface: "any",
        shape: "disc",
      },
    },
  };
}

export const ORIGINAL_ART: readonly ArtSource[] = [
  fxPair("fx-eur-usd", "flag-eu", "80ad1c1d4ffece019021bff88c91bcaa2e995b14871ac82f64239dab38ad5f33"),
  fxPair("fx-gbp-usd", "flag-gb", "a146f788c0af5537d5b2cb65e9e8afed43918d03696c4f0fbe8fa38a75754257"),
  fxPair("fx-jpy-usd", "flag-jp", "430bc1b0a897bff6e5c50f00848c4d1e9a883f109a1ad988f09c722bb4f92a4e"),
  fxPair("fx-chf-usd", "flag-ch", "7a3839d6481e0f652878b01e2ed2bfc62c9728a8712a317413d01a007bebb933"),
  fxPair("fx-cad-usd", "flag-ca", "6aa948b827a6f680d50d302e3c1bdd721b08e081eaba8cf760991fc83293b3f3"),
  {
    key: "senryo-seal",
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/README.md",
    licence: SEAL_LICENCE,
    retrieved: AUTHORED,
    usage:
      "Full seal ≥ 32 device px (simplified geometry below); never recolour outside the three variants, never set 千 in a live font (brand/README.md).",
    variants: {
      symbol: {
        path: "brand/senryo-seal.svg",
        url: "brand/senryo-seal.svg",
        sha256: "1026cff09c17d2466c0bb09f543d073bc381ec9c73d478c95e1d682cd48c003d",
        viewBox: "0 0 512 512",
        insetPermille: 0,
        surface: "any",
        shape: "tile",
      },
      monoLight: {
        path: "brand/senryo-seal-mono.svg",
        url: "brand/senryo-seal-mono.svg",
        sha256: "db06ea2c49ceee05438f94ba24a2684a71d95a81a8cc17e81d5cfa94d44eb91c",
        viewBox: "0 0 512 512",
        insetPermille: 0,
        surface: "dark",
        shape: "tile",
      },
    },
  },
  {
    key: "xau-koban",
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/scripts/art.py",
    licence: ORIGINAL_LICENCE,
    retrieved: AUTHORED,
    usage: "Gold (XAU) exposure. Never Tether Gold or any issuer's token art (study LG19/LG38).",
    variants: {
      disc: {
        path: "brand/art/xau-koban-disc.svg",
        url: "brand/art/xau-koban-disc.svg",
        sha256: "f62925a3ed26357fbdab5cbb61aacb9d5b402d10b1b483e17ec8cb3e7a702b0e",
        viewBox: "0 0 256 256",
        insetPermille: 0,
        surface: "any",
        shape: "disc",
      },
      symbol: {
        path: "brand/art/xau-koban.svg",
        url: "brand/art/xau-koban.svg",
        sha256: "82f4619d2841269e48304301e5da572aadea54d12292f51c6e4dc72bcd9743a4",
        viewBox: "0 0 256 256",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
  {
    key: "xag-chogin",
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/scripts/art.py",
    licence: ORIGINAL_LICENCE,
    retrieved: AUTHORED,
    usage: "Silver (XAG) exposure. XAG has no universal issuer logo; this is Senryo's own commodity art.",
    variants: {
      disc: {
        path: "brand/art/xag-chogin-disc.svg",
        url: "brand/art/xag-chogin-disc.svg",
        sha256: "b2deeaf0219d8e9d693ad7068bd0869cc48148f11a547538c28d352b9120d00b",
        viewBox: "0 0 256 256",
        insetPermille: 0,
        surface: "any",
        shape: "disc",
      },
      symbol: {
        path: "brand/art/xag-chogin.svg",
        url: "brand/art/xag-chogin.svg",
        sha256: "9470a0ea863eebf91ce1a2d5652767d4e7ff577b07959dd02165315b886dd8f7",
        viewBox: "0 0 256 256",
        insetPermille: 0,
        surface: "any",
        shape: "free",
      },
    },
  },
];
