/**
 * Our engine's markets (D-005: gold + silver first) and the external contracts the services read. Market ids are the
 * onchain `marketId` (SeedConstants.sol GOLD_MARKET = 0, SILVER_MARKET = 1). Mainnet Chainlink feeds (D-006, 8 dec,
 * 3,600 s heartbeat); on testnet each market reads a `MirrorAggregator` the keeper relays (D-055).
 * Addresses: docs/plan/ids-and-txs.md (read 2026-09-29).
 */

export interface EngineMarket {
  id: number;
  symbol: "XAU" | "XAG";
  name: string;
  /** Chainlink `description()` asserted onchain when the feed is set. */
  feedDescription: string;
  feedDecimals: number;
  /** Mainnet Chainlink aggregator proxy. */
  mainnetFeed: `0x${string}`;
  /** Testnet mirror contract name in the address book. */
  testnetMirror: "MirrorXAU" | "MirrorXAG";
}

export const CHAINLINK_FEED_DECIMALS = 8;

export const ENGINE_MARKETS: readonly EngineMarket[] = [
  {
    id: 0,
    symbol: "XAU",
    name: "Gold",
    feedDescription: "XAU / USD",
    feedDecimals: CHAINLINK_FEED_DECIMALS,
    mainnetFeed: "0x61dD33A34E47a181EE02e42eE0546a3DA808f1B4",
    testnetMirror: "MirrorXAU",
  },
  {
    id: 1,
    symbol: "XAG",
    name: "Silver",
    feedDescription: "XAG / USD",
    feedDecimals: CHAINLINK_FEED_DECIMALS,
    mainnetFeed: "0x29bEb7e730f09D33417357dbed020B549fdF7db4",
    testnetMirror: "MirrorXAG",
  },
];

export function engineMarket(symbolOrId: string | number): EngineMarket | undefined {
  return ENGINE_MARKETS.find((m) => m.id === symbolOrId || m.symbol === symbolOrId);
}

/** Mainnet (143) tokens and Uniswap v4 (D-021; docs.uniswap.org, code-verified 29 Sep). */
export const MAINNET_EXTERNAL = {
  ausd: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
  usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  uniswapV4: {
    poolManager: "0x188d586ddcf52439676ca21a244753fa19f9ea8e",
    quoter: "0xa222dd357a9076d1091ed6aa2e16c9742dd26891",
    stateView: "0x77395f3b2e73ae90843717371294fa97cc419d64",
    universalRouter: "0xa6CE4F10d83dBdDAc17E68e1837ca9cE6a1b596e",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
  perplExchange: "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F",
} as const;
