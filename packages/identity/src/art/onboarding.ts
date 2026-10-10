/**
 * The authored J1 artwork (v2-plan §5.10, S1b.3 first pass): six onboarding scenes, the pending-passkey art, the
 * completion foil, the notification and Face ID primer heroes (S1b.13) and the twelve default avatars. Written by `brand/scripts/onboarding.py` (layered SVG masters: one
 * top-level group per unit of motion, no <text>, no filters; `brand/art/onboarding/layers.json` lists the layers and
 * `labels.json` anchors the native labels). The user's design agent or an illustrator reviews and may replace
 * any file (B12 stays open until that review passes); a swap is one file plus `codegen --rehash`.
 */
import type { ArtSource } from "../types.ts";

const AUTHORED = "2026-10-01";
const SCRIPT = "brand/scripts/onboarding.py";
const SCENE_BOX = "0 0 756 940";
const EXTRA_BOX = "0 0 640 640";
const AVATAR_BOX = "0 0 256 256";
const LICENCE =
  "Senryo original artwork (brand/scripts/onboarding.py). Materials from the Living Lacquer ramps (v2-plan §5.2); the " +
  "千 is the seal's outlined glyph (SIL OFL 1.1). First-pass master pending design review (B12).";
const COMPOSED =
  " Real marks inside it are the registered files, uniformly scaled, never recoloured or distorted; each keeps its " +
  "own licence and usage note (see derivedFrom).";

function master(key: string, folder: string, viewBox: string, sha256: string, shape: "tile" | "free") {
  const path = `brand/art/${folder}/${key}.svg`;
  return { symbol: { path, url: path, sha256, viewBox, insetPermille: 0, surface: "any", shape } } as const;
}

/** One onboarding scene: a full-bleed 378 × 470 pt hero (the app clips it to the 32 pt rounded hero). */
function scene(key: string, subject: string, sha256: string, derivedFrom: readonly string[] = []): ArtSource {
  return {
    key,
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: SCRIPT,
    licence: derivedFrom.length > 0 ? LICENCE + COMPOSED : LICENCE,
    retrieved: AUTHORED,
    usage: `J1 story scene. ${subject} Artwork only: copy, amounts and controls are the app's, never drawn into it.`,
    ...(derivedFrom.length > 0 ? { derivedFrom } : {}),
    variants: master(key, "onboarding", SCENE_BOX, sha256, "tile"),
  };
}

/** A default avatar: a full-bleed square the app clips to a disc; stable per account until its owner picks another. */
function avatar(key: string, sha256: string): ArtSource {
  return {
    key,
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/scripts/avatars.py",
    licence: LICENCE,
    retrieved: AUTHORED,
    usage:
      "Default avatar (one of twelve, one family). Keep the whole square; clip to a disc, never crop into the face.",
    variants: master(key, "avatars", AVATAR_BOX, sha256, "tile"),
  };
}

export const ONBOARDING_ART: readonly ArtSource[] = [
  scene(
    "scene-call",
    "Call the next move. A gold line wanders, then climbs past the dashed line on a lacquer tablet to a glowing head; an Up dish and a Down dish hover beside it.",
    "d29ed7e38d8046f74f127ce74342e6f481566e4ce45479afcc12bdc1af1823c2",
  ),
  scene(
    "scene-payout",
    "Payouts land on their own. Three koban fall to the lacquer senryō-bako, the lowest landing on its lid.",
    "a021a4803d2c4addc646ded86a8a29f065db60a9671fd369117265af4eb710ba",
    ["xau-koban"],
  ),
  scene(
    "scene-passkey",
    "Passkey. The silver key settling into its lacquer bed, with a phone and the seal tag.",
    "162745848c89f07f18d86248d855a9bc1e65c4545a310c3d9058eeb93a763233",
  ),
  scene(
    "scene-lp",
    "LP vault. The lacquer vault well, its round bolted door open, one shared pool inside.",
    "8f64ab80b67fff605a260d7754b39168b48fb48ee6e5a3de75d4e69cbd9487d4",
  ),
  scene(
    "scene-modes",
    "Practice / Mainnet. Washi notes in the practice violet in front; koban and chōgin in a tray lined in the mainnet blue, apart. Mode names are native text over its label plates (labels.json).",
    "855cb34bfb6c727e06bcd888719d2695d075373c1349837deed85d778e24099c",
    ["xau-koban", "xag-chogin"],
  ),
  {
    key: "passkey-pending",
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/scripts/pending.py",
    licence: LICENCE,
    retrieved: AUTHORED,
    usage:
      "Shown while the OS passkey sheet is open. It may sway and glint; it never counts, fills or scans. Transparent ground, both themes.",
    variants: master(
      "passkey-pending",
      "onboarding",
      EXTRA_BOX,
      "0a011a5284960d71391d378584e2a4a04a6d93a5c472e919cc318bf3410f7ba9",
      "free",
    ),
  },
  {
    key: "completion-foil",
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/scripts/foil.py",
    licence: LICENCE,
    retrieved: AUTHORED,
    usage:
      "Shown only after the named outcome is verified (account created, credit finalized). Transparent ground, both themes.",
    variants: master(
      "completion-foil",
      "onboarding",
      EXTRA_BOX,
      "10e28e34ea3d2175d15b83668a050e4bfe35f868fb947c3c8fb428984e7ed995",
      "free",
    ),
  },
  {
    key: "primer-notifications",
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/scripts/primer_bell.py",
    licence: LICENCE,
    retrieved: AUTHORED,
    usage:
      "Notification primer hero: a gold fūrin, its coin clapper and indigo tanzaku caught in a breeze, arcs of light off its shoulders. It may sway and glint (the tanzaku most, about its pivot in layers.json) and the ring may spread once as the clapper strikes; never on a loop, never as if an alert had arrived. Transparent ground, both themes.",
    variants: master(
      "primer-notifications",
      "onboarding",
      EXTRA_BOX,
      "92c9b60473e4252ee29b60de52fda4379d99e039b4f56ca198b17d1c2309157a",
      "free",
    ),
  },
  {
    key: "primer-face-id",
    owner: "Senryo",
    provenance: "senryo-original",
    pageUrl: "brand/scripts/primer_lock.py",
    licence: LICENCE,
    retrieved: AUTHORED,
    usage:
      "Face ID primer hero: an ebi-jō lock opened, four corners of light round it. The shackle may lift and settle; nothing scans, counts or fills. It is not the system Face ID glyph, which stays on the control. Transparent ground, both themes.",
    variants: master(
      "primer-face-id",
      "onboarding",
      EXTRA_BOX,
      "240dc72fa775c901bb2967988a5025735309e21985a70e4abd71d64036ed01a4",
      "free",
    ),
  },
  avatar("avatar-01-topknot", "123b2da4073c6f5d5edc9317d6041fd1fcf0e488247898c38a3ae23b40a1ad62"),
  avatar("avatar-02-bob", "b00022445cd12688f07ce760e3104e9399e55689b29327e80c18ba2f09a5bdbb"),
  avatar("avatar-03-kanzashi", "3a64bced1e46d9ecc214a07d1870dbe2a343c42af23a9b535571a033dea9f2db"),
  avatar("avatar-04-hachimaki", "958d129fc04982088b7fcf13a524845b6c08493e5b76a3efbb6ec9527adc1c4c"),
  avatar("avatar-05-curls", "4874be8dea6d5d8df2b26d0e64d3ada63fb329306ba527a9ad6b91b7e58799e8"),
  avatar("avatar-06-elder", "1b5cf8af332b15fbc8910806e7dd0a828d8d799d3cd427f679ba303eeb40f1ce"),
  avatar("avatar-07-buns", "1b3221fe6942ad8c2d2a00f710a5a9f1aa48aee31c8853f589ac5b55b22d7b79"),
  avatar("avatar-08-sweep", "65c7b13c84b579160549def139f905270c9470a4f6736a9c51a4765cf44d93c3"),
  avatar("avatar-09-ponytail", "3bac6d5a121070c39d83b4d6c652201a1a048cfb005dd14a89c88cc98157c3ab"),
  avatar("avatar-10-scarf", "8d5b99fa68120d70573a3f84e2f7693c0229e6cf7e86e841e7e0285f6c570f2f"),
  avatar("avatar-11-kasa", "9848b7bf72d7e960b46b3b97dfbe03bbb1e1b073e189c0f9d9e670af42659c3b"),
  avatar("avatar-12-kitsune", "f2ad779c0fd886fc65d2f42a46157fe472276abd7c95e92b0a2719e0a5d009ec"),
];
