/**
 * Rides — "ride the price" (D-299, D-301, D-305): which markets ride (v1: the 24/7 Pyth crypto, in their on-chain
 * order — the contract names a ride market by index, so the list only ever grows) and each network's terms, inside the
 * contracts' compile-time bounds (`RideTypes.sol`). Real-money rides are web-only until S9 (D-305).
 */
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

/** Ride markets by on-chain id (append-only). */
export const RIDE_MARKETS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "HYPE"] as const;
export type RideSymbol = (typeof RIDE_MARKETS)[number];

/** Dollars are 6-decimal on both networks. */
const USD = 1_000_000;

export interface RideMarketTerms {
  maxLeverageBps: number;
  takerFeeBps: number;
  makerFeeBps: number;
}

export interface RideNetworkTerms {
  /** Per market: leverage and fees (D-301: 5 bps a side on BTC/ETH/SOL, 8 on other crypto; 2 when reducing skew). */
  markets: Readonly<Record<RideSymbol, RideMarketTerms>>;
  /** The reserve is margin × min(maxProfit, leverage × maxMove) (testnet min(900 %, L×25 %), mainnet min(200 %, L×10 %)). */
  maxProfitBps: number;
  maxMoveBps: number;
  marketReserveBps: number;
  marketReserveCap: bigint;
  skewCapBps: number;
  maxLifeSec: number;
  minMargin: bigint;
  maxMargin: bigint;
  /** Contracts `RideTerms`: rides' share of the pool, the hourly loss brake, the early-close fee. */
  maxLinearBps: number;
  maxHourlyLossBps: number;
  earlyFeeBps: number;
  earlyWindowSec: number;
}

const MAJOR_FEE = { takerFeeBps: 5, makerFeeBps: 2 } as const;
const OTHER_FEE = { takerFeeBps: 8, makerFeeBps: 2 } as const;
/** Leverage × 1e4 (contracts bps): 40× is 400,000. */
const X = 10_000;
const SHARED = {
  maxLifeSec: 4 * 3600,
  minMargin: BigInt(USD),
  maxLinearBps: 3_000,
  maxHourlyLossBps: 1_000,
  earlyFeeBps: 20,
  earlyWindowSec: 15,
} as const;

export const RIDE_TERMS: Readonly<Record<ChainId, RideNetworkTerms>> = {
  [TESTNET_CHAIN_ID]: {
    ...SHARED,
    // Tradash/Bulk: 40× BTC, 25× ETH, 20× SOL, 10× the rest.
    markets: {
      BTC: { maxLeverageBps: 40 * X, ...MAJOR_FEE },
      ETH: { maxLeverageBps: 25 * X, ...MAJOR_FEE },
      SOL: { maxLeverageBps: 20 * X, ...MAJOR_FEE },
      XRP: { maxLeverageBps: 10 * X, ...OTHER_FEE },
      BNB: { maxLeverageBps: 10 * X, ...OTHER_FEE },
      DOGE: { maxLeverageBps: 10 * X, ...OTHER_FEE },
      HYPE: { maxLeverageBps: 10 * X, ...OTHER_FEE },
    },
    maxProfitBps: 90_000,
    maxMoveBps: 2_500,
    marketReserveBps: 1_500,
    marketReserveCap: BigInt(1_500_000 * USD),
    skewCapBps: 5_000,
    maxMargin: BigInt(1_000 * USD),
  },
  [MAINNET_CHAIN_ID]: {
    ...SHARED,
    // 20× BTC/ETH, 10× other crypto (5× would be RedStone and stocks, which don't ride yet).
    markets: {
      BTC: { maxLeverageBps: 20 * X, ...MAJOR_FEE },
      ETH: { maxLeverageBps: 20 * X, ...MAJOR_FEE },
      SOL: { maxLeverageBps: 10 * X, ...MAJOR_FEE },
      XRP: { maxLeverageBps: 10 * X, ...OTHER_FEE },
      BNB: { maxLeverageBps: 10 * X, ...OTHER_FEE },
      DOGE: { maxLeverageBps: 10 * X, ...OTHER_FEE },
      HYPE: { maxLeverageBps: 10 * X, ...OTHER_FEE },
    },
    maxProfitBps: 20_000,
    maxMoveBps: 1_000,
    marketReserveBps: 1_000,
    // Sized to the seed at S9, like the calls' per-expiry cap.
    marketReserveCap: BigInt(500 * USD),
    skewCapBps: 3_000,
    maxMargin: BigInt(25 * USD),
  },
};
