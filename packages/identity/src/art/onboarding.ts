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
    "3b137a6d8b025bb504f6e3db90bffb4abbe3c9e99b34f7c06518baa9329c59ff",
  ),
  scene(
    "scene-payout",
    "Payouts land on their own. Three koban fall to the lacquer senryō-bako, the lowest landing on its lid.",
    "188c5c768f7a8fa3dcd813f86758fb2d05dbd832bda06c57d0b6f9bb5fae5707",
    ["xau-koban"],
  ),
  scene(
    "scene-passkey",
    "Passkey. The silver key settling into its lacquer bed, with a phone and the seal tag.",
    "ed459da3e8b4603a07ee3f579a01e63d1cac0f4b2d131f6dcc7f8bcbaf8902a8",
  ),
  scene(
    "scene-lp",
    "LP vault. The lacquer vault well, its round bolted door open, one shared pool inside.",
    "698ffa82a49092719bbdee8d495c7cb3c2fbeefadb33f07a195a4e5597f44e9d",
  ),
  scene(
    "scene-modes",
    "Practice / Mainnet. Washi notes in the practice violet in front; koban and chōgin in a tray lined in the mainnet blue, apart. Mode names are native text over its label plates (labels.json).",
    "dad61399a3c53d5a01283890f8ca614eb71a1ef2e169728b1495be7a672fbbcc",
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
      "777803ad720d1ae4b144de5482ef7238195075105aa8b2f8220d375f1924d078",
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
      "d592de151c0aff95520e0d6c9a465fcce0f03e1b8a4b9c920f8a865dc7bc629e",
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
      "40d54a3e8b2acd91129af5522b1063b3e550956f7f6fbb24bea97984f17d0d7b",
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
      "2791b81d7be021246333b5eefc6cf79ee15fb8711ce5ead2d683df92521b761d",
      "free",
    ),
  },
  avatar("avatar-01-topknot", "e10a0c5ca1d7a0689122cb531c58d00a3932e25c16d313b9879378683b0da710"),
  avatar("avatar-02-bob", "bc572d53ab3db0a4a05381257e5a90f6c09579f620acaf50ba4cf99f8b988d09"),
  avatar("avatar-03-kanzashi", "ba6eb9ad76cbe5e55188c3a849984922d97aaf935283e25a73a6a7c4d3f83f85"),
  avatar("avatar-04-hachimaki", "3681e1a734033effb9113d8923599ee76a8793409bdb20448e7f0acea339c10a"),
  avatar("avatar-05-curls", "f44f68dd88808e61a0a84d3033ae563c7dba8404ee1b6360fea0baf70fe91467"),
  avatar("avatar-06-elder", "2e5128ff0d156f7970b661aaac73b967cf958ad983cd9e12fb31fd03af0f32ef"),
  avatar("avatar-07-buns", "f218b4cbbaab1f364a2103b8dbbe65ac0edbbe484716875a5af712d7bfc5c223"),
  avatar("avatar-08-sweep", "36bf0bf88d3d6937130f76836002180f29a111babd8bfd9437066471b924b198"),
  avatar("avatar-09-ponytail", "e044a5b94c73c5a69125c3015f311a3b2e625e44153d2995f1438a7c45e7db55"),
  avatar("avatar-10-scarf", "f4789b9a9482168767093c332cb9509c63e750d2e71d9a343f9e21b8f0b5d24a"),
  avatar("avatar-11-kasa", "1bae52cfddea573810d1a7f5d6bc379f3f73510d4b2f26352d68ff2c1b7570e8"),
  avatar("avatar-12-kitsune", "f73467af8096fa4e12d99dcb86001f5b54421bb54103209ad600045339560921"),
];
