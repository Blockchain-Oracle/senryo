/** Brand strings (D-003, D-049). The rpId/domain lives in packages/config once it exists (S6). */
export const BRAND = {
  name: "Senryo",
  kanji: "千両",
  wordmark: "SENRYO",
  card: "Kinpaku",
  cardKanji: "金箔",
  title: "Senryo 千両 — gold, markets and a card on one balance",
  description:
    "Trade gold, silver, equities, FX and crypto perps on Monad from one risk-accounted balance, and spend it with the Kinpaku card.",
  network: "MONAD",
} as const;

/**
 * Top-bar seal edge (CSS px). brand/README.md: the full seal needs ≥ 32 device px (below that, use the favicon mark),
 * so the bar draws it at 32 and a 1× screen still gets the whole carving.
 */
export const SEAL_MARK_SIZE = 32;
/** The mode label's network mark (the phone's mode capsule). */
export const MODE_MARK_SIZE = 20;
/** Mark edges (CSS px; the phone's SIZE.markDetail / markToken / markHero). */
export const MARK_ROW = 40;
export const MARK_SMALL = 24;
export const MARK_HERO = 56;
