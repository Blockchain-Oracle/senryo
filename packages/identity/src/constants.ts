/** Identity data constants: external chain ids, venue market ids and token addresses the entity table is keyed by. */

/** External EVM chains shown in funding routes (EIP-155 ids). */
export const EXTERNAL_CHAIN_IDS = { ethereum: 1, base: 8453, arbitrum: 42161, bnb: 56, polygon: 137 } as const;

/**
 * Practice's dollar on Monad testnet (S2 deploy, 8 Oct 2026). The `identity-provenance` invariant fails if the address
 * book's `TestUSD` moves without this, so a redeploy can't silently orphan the mark.
 */
export const PRACTICE_DOLLAR = "0xeA23d6884b7861d2b9324C6A542020e8995cd3D3" as const;

/** Circle-issued USDC outside Monad (developers.circle.com/stablecoins/usdc-contract-addresses, read 2026-09-30). */
export const USDC_ELSEWHERE = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  solanaMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

// --- EntityMark layout (shared by native and web) ---

/** Share of the mark's edge the badge takes, and how far it hangs past the corner. */
export const BADGE_RATIO = 0.42;
/** A basket's mark draws at most this many of its members, overlapped (R2.6). */
export const CLUSTER_MAX = 3;
/** A member's disc as a share of the mark, for two members and for three. */
export const CLUSTER_PAIR_RATIO = 0.68;
export const CLUSTER_TRIO_RATIO = 0.6;
/** The ground ring that separates overlapped members, as a share of a member's disc (never under 1 px). */
export const CLUSTER_RING_RATIO = 0.08;
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
