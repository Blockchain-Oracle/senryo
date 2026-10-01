/** Identity data constants: external chain ids, venue market ids and token addresses the entity table is keyed by. */

/** External EVM chains shown in funding routes (EIP-155 ids). */
export const EXTERNAL_CHAIN_IDS = { ethereum: 1, base: 8453, arbitrum: 42161, bnb: 56, polygon: 137 } as const;

/**
 * Practice collateral mocks from `packages/contracts/src/addresses/10143.json` (invariant `identity-provenance`
 * cross-checks them against the address book so a redeploy can't silently orphan their marks).
 */
export const PRACTICE_TOKENS = {
  ausd: "0xA56060259F6c5EF2b18257caEe1F51782e069E23",
  usdc: "0x68225DA6Df9d1Bd54f26D308Fb453333dC2a69A1",
} as const;

/** Circle-issued USDC outside Monad (developers.circle.com/stablecoins/usdc-contract-addresses, read 2026-09-30). */
export const USDC_ELSEWHERE = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  solanaMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

/** Perpl market ids per network: the registry lives in `@senryo/config` (`perpl.ts`), shared with discovery. */
export { PERPL_MARKETS } from "@senryo/config";

// --- EntityMark layout (shared by native and web) ---

/** Share of the mark's edge the badge takes, and how far it hangs past the corner. */
export const BADGE_RATIO = 0.42;
export const BADGE_OUTSET_RATIO = 0.06;
/** The badge's cut-out ring: a share of the badge edge, never thinner than a hairline pair. */
export const BADGE_RING_RATIO = 0.12;
export const BADGE_RING_MIN = 1.5;
/** Clear space inside a plate around an uncontained mark (share of the edge, each side). */
export const PLATE_PADDING_RATIO = 0.18;
/** A tile (rounded square) keeps the seal's corner: 14/512 of its edge. */
export const TILE_RADIUS_RATIO = 14 / 512;
/** Fallback text: at most this many characters, at this share of the edge. */
export const FALLBACK_MAX_CHARS = 4;
export const FALLBACK_FONT_RATIO = 0.28;
export const FALLBACK_FONT_RATIO_LONG = 0.22;
export const FALLBACK_SHORT_CHARS = 3;
/** Dash pattern (share of the edge) that marks a fallback as "no artwork", never a logo. */
export const FALLBACK_DASH_RATIO = 0.08;
export const FALLBACK_RIM_RATIO = 0.04;
export const FALLBACK_RIM_MIN = 1;
export const PERMILLE = 1000;
/** Fallback text leading (multiple of its size) and weight. */
export const FALLBACK_LEADING = 1.2;
export const FALLBACK_WEIGHT = 600;
/** The plate's hairline rim. */
export const PLATE_STROKE = 1;
