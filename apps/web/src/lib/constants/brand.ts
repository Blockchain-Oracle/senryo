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

/** Top-bar seal edge (px). brand/README.md: the full seal needs ≥ 24 px (below that, use the favicon mark). */
export const SEAL_MARK_SIZE = 24;
