/**
 * Theme-independent identity colours: the Kinpaku 金箔 foil, the fixed QR ink/paper (scanners need black on white),
 * and third-party chain/asset identity hues used for small glyph discs. Same in dark and light.
 */

/**
 * Kinpaku card: gold leaf on lacquer, on the direction's material ramps (§2): gold leaf #886426 / #D4AE5B / #FFF0BC
 * at foil stops 0 / 50 / 100 %, with Codex's 25 % and 75 % intermediates; lacquer shadow / midtone for the body / edge.
 */
export const KINPAKU = {
  lacquer: "#17121B",
  lacquerEdge: "#29212F",
  foilHighlight: "#FFF0BC",
  foilLight: "#EACF8C",
  foilMid: "#D4AE5B",
  foilShade: "#AE8941",
  foilDeep: "#886426",
} as const;

export const QR = { ink: "#000000", paper: "#ffffff" } as const;

/** Chain identity colours (chain picker dots). */
export const CHAIN_HUE = {
  monad: "#836ef9",
  base: "#0052ff",
  ethereum: "#627eea",
  solana: "#14f195",
  arbitrum: "#28a0f0",
} as const;

/** Asset glyph discs; unknown symbols fall back to `--primary`. */
export const ASSET_HUE = {
  XAU: "#d4af37",
  XAG: "#a8a9ad",
  NVDA: "#76b900",
  AAPL: "#8e8e93",
  TSLA: "#e31937",
  "EUR/USD": "#2a5bd7",
  "GBP/USD": "#5b2ad7",
  BTC: "#f7931a",
  ETH: "#627eea",
  MON: "#836ef9",
  USDC: "#2775ca",
  AUSD: "#836ef9",
} as const;

export type ChainKey = keyof typeof CHAIN_HUE;
export type AssetKey = keyof typeof ASSET_HUE;
