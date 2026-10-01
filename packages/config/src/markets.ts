/**
 * Our engine's markets. Market ids are the onchain `marketId` (SeedConstants.sol GOLD_MARKET = 0, SILVER_MARKET = 1,
 * EUR_MARKET … CAD_MARKET = 2…6). Mainnet reads Chainlink push feeds (metals D-006: 8 dec, 3,600 s heartbeat; FX
 * D-186: 18 dec, 240 s heartbeat, 0.15 % deviation); on testnet each market reads a `MirrorAggregator` the keeper
 * relays (D-055). The quote is always the feed's own orientation: JPY is JPY / USD (USD per yen), never inverted.
 * Addresses: docs/plan/ids-and-txs.md (metals, read 2026-09-29) and SeedConstants.sol (FX, read 2026-09-30).
 */
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

export type EngineSymbol = "XAU" | "XAG" | "EUR" | "GBP" | "JPY" | "CHF" | "CAD";
export type EngineCategory = "metal" | "fx";
export type MirrorName = `Mirror${EngineSymbol}`;

export interface EngineMarket {
  id: number;
  symbol: EngineSymbol;
  name: string;
  category: EngineCategory;
  /** Chainlink `description()` asserted onchain when the feed is set ("<BASE> / USD"). */
  feedDescription: string;
  feedDecimals: number;
  /**
   * Decimals to display a price with (the value stays 1e18): metals in cents; FX to a tenth of a pip — EUR/USD
   * 1.13314, and JPY/USD (USD per yen) 0.0063536, never shown inverted.
   */
  priceDecimals: number;
  /** Mainnet Chainlink aggregator proxy. */
  mainnetFeed: `0x${string}`;
  /** Testnet mirror contract name in the address book. */
  testnetMirror: MirrorName;
  /**
   * Chains whose SenryoCore lists this market. FX is in the mainnet constructor (Deploy.s.sol); on 10143 it lists
   * through the timelocked `AddMarkets.s.sol` — add TESTNET_CHAIN_ID here after its execute run (S8.23 [OK?]).
   */
  chains: readonly ChainId[];
}

export const CHAINLINK_FEED_DECIMALS = 8;
/** Chainlink FX feeds on Monad publish 18 decimals (SeedConstants.FX_FEED_DECIMALS). */
export const CHAINLINK_FX_FEED_DECIMALS = 18;
const METAL_PRICE_DECIMALS = 2;
const FX_PRICE_DECIMALS = 5;
const JPY_PRICE_DECIMALS = 7;

const BOTH_CHAINS: readonly ChainId[] = [MAINNET_CHAIN_ID, TESTNET_CHAIN_ID];
const MAINNET_ONLY: readonly ChainId[] = [MAINNET_CHAIN_ID];

function fx(
  id: number,
  symbol: EngineSymbol,
  name: string,
  mainnetFeed: `0x${string}`,
  priceDecimals = FX_PRICE_DECIMALS,
): EngineMarket {
  return {
    id,
    symbol,
    name,
    category: "fx",
    feedDescription: `${symbol} / USD`,
    feedDecimals: CHAINLINK_FX_FEED_DECIMALS,
    priceDecimals,
    mainnetFeed,
    testnetMirror: `Mirror${symbol}`,
    chains: MAINNET_ONLY,
  };
}

export const ENGINE_MARKETS: readonly EngineMarket[] = [
  {
    id: 0,
    symbol: "XAU",
    name: "Gold",
    category: "metal",
    feedDescription: "XAU / USD",
    feedDecimals: CHAINLINK_FEED_DECIMALS,
    priceDecimals: METAL_PRICE_DECIMALS,
    mainnetFeed: "0x61dD33A34E47a181EE02e42eE0546a3DA808f1B4",
    testnetMirror: "MirrorXAU",
    chains: BOTH_CHAINS,
  },
  {
    id: 1,
    symbol: "XAG",
    name: "Silver",
    category: "metal",
    feedDescription: "XAG / USD",
    feedDecimals: CHAINLINK_FEED_DECIMALS,
    priceDecimals: METAL_PRICE_DECIMALS,
    mainnetFeed: "0x29bEb7e730f09D33417357dbed020B549fdF7db4",
    testnetMirror: "MirrorXAG",
    chains: BOTH_CHAINS,
  },
  fx(2, "EUR", "Euro", "0x00D7E359c8CE46168eFDD4D65b708fFb16c4b99a"),
  fx(3, "GBP", "British pound", "0x1ffC8B75a16FFfbd7879F042B580F7607Dcf5C30"),
  fx(4, "JPY", "Japanese yen", "0xF64664Ea54cE47eCC7a1816C49d1Bc6deF828927", JPY_PRICE_DECIMALS),
  fx(5, "CHF", "Swiss franc", "0x6DBa7f3A7B5B7c1079337104caD14D19150F6B8d"),
  fx(6, "CAD", "Canadian dollar", "0x3293eA5650E9f8c4091642b7EB1C46CFEe5197cA"),
];

export function engineMarket(symbolOrId: string | number): EngineMarket | undefined {
  return ENGINE_MARKETS.find((m) => m.id === symbolOrId || m.symbol === symbolOrId);
}

/** The markets SenryoCore lists on `chainId` — iterate this for chain reads (an unlisted id reverts onchain). */
export function engineMarketsOn(chainId: ChainId): readonly EngineMarket[] {
  return ENGINE_MARKETS.filter((m) => m.chains.includes(chainId));
}

/** Display pair in the feed's orientation ("EUR/USD", "JPY/USD", "XAU/USD"). */
export function marketPair(market: Pick<EngineMarket, "symbol">): string {
  return `${market.symbol}/USD`;
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
