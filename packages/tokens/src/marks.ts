/**
 * Theme-independent colours: the authored materials (gold leaf, silver, lacquer), the Kinpaku 金箔 foil built from them,
 * and the fixed QR ink/paper (scanners need black on white). Same in dark and light. Third-party identity never comes from
 * a colour here: real marks live in `@senryo/identity` (the old CHAIN_HUE/ASSET_HUE maps were deleted in S1b.6).
 */

/** Material ramps (direction §2): shadow / midtone / highlight for artwork, never UI semantics. */
export const MATERIAL = {
  goldLeaf: { shadow: "#886426", mid: "#D4AE5B", highlight: "#FFF0BC" },
  silver: { shadow: "#697383", mid: "#C9D0DD", highlight: "#F4F6FB" },
  lacquer: { shadow: "#17121B", mid: "#29212F", highlight: "#514357" },
} as const;

/**
 * Kinpaku card: gold leaf on lacquer. Foil stops 0 / 25 / 50 / 75 / 100 % run the gold-leaf ramp with Codex's two
 * intermediates (#AE8941, #EACF8C); the body and edge are the lacquer shadow and midtone, lit by `lacquerHighlight`.
 */
export const KINPAKU = {
  lacquer: MATERIAL.lacquer.shadow,
  lacquerEdge: MATERIAL.lacquer.mid,
  lacquerHighlight: MATERIAL.lacquer.highlight,
  foilHighlight: MATERIAL.goldLeaf.highlight,
  foilLight: "#EACF8C",
  foilMid: MATERIAL.goldLeaf.mid,
  foilShade: "#AE8941",
  foilDeep: MATERIAL.goldLeaf.shadow,
} as const;

export const QR = { ink: "#000000", paper: "#FFFFFF" } as const;

/** The welcome sky (the story's ground) and its ink: also the share card's background, on both apps. */
export const WELCOME = { sky: "#428FC8", ink: "#FFFFFF" } as const;

/** Solflare's onboarding scene fields: artwork backgrounds only, never trading semantics or page grounds (direction §2). */
export const SCENE_FIELD = {
  yellow: "#FAF543",
  periwinkle: "#7690ED",
  lime: "#C4DA78",
  pink: "#F58CE1",
  orange: "#F1803A",
  gray: "#B7BBC6",
} as const;
