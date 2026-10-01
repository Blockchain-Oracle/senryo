/**
 * PREVIEW DATA — the single source of every number the S5 shell shows. None of it is a user's balance, a live price or
 * a real card. Every screen that reads this file shows <PreviewBadge />. S6–S8 replace these reads screen by screen
 * (account/buckets from chain, markets from the oracle + Perpl, card from services/card) and delete this file.
 * Money is integer base units, as everywhere: usd6, e8 oracle prices, bps.
 */

import { BPS_DENOMINATOR } from "@senryo/core";
import {
  CANDLE_BODY_BPS,
  CANDLE_COUNT,
  CANDLE_STEP_MS,
  CANDLE_WICK_BPS,
  EQUITY_DRIFT_BPS,
  EQUITY_POINTS,
  EQUITY_STEP_BPS,
  EQUITY_STEP_MS,
  PRNG,
  SAMPLE_SEED,
  SPARK_POINTS,
  SPARK_STEP_BPS,
} from "./constants/sample";

export const SAMPLE_NOTE = "Sample numbers for the preview build. Not your balance, not a live price.";

export type Venue = "senryo" | "perpl";
export type MarketStatus = "open" | "closed" | "soon";
export type AssetClass = "metals" | "crypto" | "fx" | "equity";

export interface SampleMarket {
  id: string;
  name: string;
  assetClass: AssetClass;
  venue: Venue;
  status: MarketStatus;
  maxLeverage: number;
  priceE8: bigint;
  change24hBps: bigint;
  openInterest6: bigint;
  spark: number[];
}

export interface SamplePosition {
  id: string;
  market: string;
  side: "long" | "short";
  leverage: number;
  size6: bigint;
  entryE8: bigint;
  liqE8: bigint;
  pnl6: bigint;
  liqDistanceBps: bigint;
}

export interface SampleBuckets {
  equity6: bigint;
  change24h6: bigint;
  change24hBps: bigint;
  freeToTrade6: bigint;
  freeToSpend6: bigint;
  locked6: bigint;
  inPerpl6: bigint;
}

export interface EquityPoint {
  t: number;
  equity6: bigint;
}

export interface Candle {
  t: number;
  openE8: bigint;
  highE8: bigint;
  lowE8: bigint;
  closeE8: bigint;
}

export interface CardAuth {
  id: string;
  merchant: string;
  state: "hold" | "settled" | "declined";
  amount6: bigint;
}

/** mulberry32: a tiny seeded PRNG so the preview is identical on every launch. */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + PRNG.inc) | 0;
    let t = Math.imul(a ^ (a >>> PRNG.m1), 1 | a);
    t = (t + Math.imul(t ^ (t >>> PRNG.m2), PRNG.m3 | t)) ^ t;
    return ((t ^ (t >>> PRNG.s1)) >>> 0) / PRNG.max;
  };
}

/** A signed step in [-maxBps, +maxBps] as bigint bps. */
function stepBps(rand: () => number, maxBps: number): bigint {
  return BigInt(Math.round((rand() * 2 - 1) * maxBps));
}

function applyBps(value: bigint, bps: bigint): bigint {
  return value + (value * bps) / BPS_DENOMINATOR;
}

const SAMPLE_NOW = Date.UTC(2026, 9, 13, 12, 0, 0);

function series(seed: number, start: bigint, count: number, stepMax: number, drift: number): bigint[] {
  const rand = prng(seed);
  const out: bigint[] = [];
  let v = start;
  for (let i = 0; i < count; i += 1) {
    out.push(v);
    v = applyBps(v, stepBps(rand, stepMax) + BigInt(drift));
  }
  return out;
}

function spark(seed: number, trend: number): number[] {
  return series(seed, 1_000_000n, SPARK_POINTS, SPARK_STEP_BPS, trend).map((v) => Number(v));
}

export const SAMPLE_BUCKETS: SampleBuckets = {
  equity6: 12_480_520_000n,
  change24h6: 184_220_000n,
  change24hBps: 150n,
  freeToTrade6: 7_210_000_000n,
  freeToSpend6: 3_120_000_000n,
  locked6: 2_150_000_000n,
  inPerpl6: 450_000_000n,
};

export const SAMPLE_EQUITY: EquityPoint[] = series(
  SAMPLE_SEED,
  11_735_000_000n,
  EQUITY_POINTS,
  EQUITY_STEP_BPS,
  EQUITY_DRIFT_BPS,
).map((equity6, i) => ({ t: SAMPLE_NOW - (EQUITY_POINTS - 1 - i) * EQUITY_STEP_MS, equity6 }));

export const SAMPLE_MARKETS: SampleMarket[] = [
  {
    id: "XAU",
    name: "Gold",
    assetClass: "metals",
    venue: "senryo",
    status: "open",
    maxLeverage: 20,
    priceE8: 268_740_000_000n,
    change24hBps: 82n,
    openInterest6: 18_400_000_000_000n,
    spark: spark(1, 3),
  },
  {
    id: "XAG",
    name: "Silver",
    assetClass: "metals",
    venue: "senryo",
    status: "open",
    maxLeverage: 20,
    priceE8: 3_184_000_000n,
    change24hBps: -41n,
    openInterest6: 4_200_000_000_000n,
    spark: spark(2, -3),
  },
  {
    id: "BTC",
    name: "Bitcoin",
    assetClass: "crypto",
    venue: "perpl",
    status: "open",
    maxLeverage: 25,
    priceE8: 6_421_050_000_000n,
    change24hBps: 146n,
    openInterest6: 41_000_000_000_000n,
    spark: spark(3, 4),
  },
  {
    id: "ETH",
    name: "Ether",
    assetClass: "crypto",
    venue: "perpl",
    status: "open",
    maxLeverage: 25,
    priceE8: 341_280_000_000n,
    change24hBps: 266n,
    openInterest6: 22_000_000_000_000n,
    spark: spark(4, 6),
  },
  {
    id: "MON",
    name: "Monad",
    assetClass: "crypto",
    venue: "perpl",
    status: "open",
    maxLeverage: 10,
    priceE8: 94_810_000n,
    change24hBps: 612n,
    openInterest6: 9_800_000_000_000n,
    spark: spark(5, 9),
  },
  {
    id: "EURUSD",
    name: "Euro / Dollar",
    assetClass: "fx",
    venue: "senryo",
    status: "soon",
    maxLeverage: 50,
    priceE8: 108_420_000n,
    change24hBps: 11n,
    openInterest6: 0n,
    spark: spark(6, 1),
  },
  {
    id: "NVDA",
    name: "Nvidia",
    assetClass: "equity",
    venue: "senryo",
    status: "soon",
    maxLeverage: 10,
    priceE8: 13_624_000_000n,
    change24hBps: 382n,
    openInterest6: 0n,
    spark: spark(7, 5),
  },
];

export const SAMPLE_POSITIONS: SamplePosition[] = [
  {
    id: "pos-xau-1",
    market: "XAU",
    side: "long",
    leverage: 5,
    size6: 1_500_000_000n,
    entryE8: 265_040_000_000n,
    liqE8: 214_010_000_000n,
    pnl6: 102_400_000n,
    liqDistanceBps: 1_200n,
  },
  {
    id: "pos-xag-1",
    market: "XAG",
    side: "short",
    leverage: 3,
    size6: 650_000_000n,
    entryE8: 3_210_000_000n,
    liqE8: 4_180_000_000n,
    pnl6: 13_400_000n,
    liqDistanceBps: 3_100n,
  },
];

export const SAMPLE_CANDLES: Candle[] = (() => {
  const rand = prng(SAMPLE_SEED + 1);
  const out: Candle[] = [];
  let open = 262_100_000_000n;
  for (let i = 0; i < CANDLE_COUNT; i += 1) {
    const close = applyBps(open, stepBps(rand, CANDLE_BODY_BPS) + 2n);
    const top = open > close ? open : close;
    const bottom = open > close ? close : open;
    out.push({
      t: SAMPLE_NOW - (CANDLE_COUNT - 1 - i) * CANDLE_STEP_MS,
      openE8: open,
      closeE8: close,
      highE8: applyBps(top, BigInt(Math.round(rand() * CANDLE_WICK_BPS))),
      lowE8: applyBps(bottom, -BigInt(Math.round(rand() * CANDLE_WICK_BPS))),
    });
    open = close;
  }
  return out;
})();

export const SAMPLE_CARD = {
  last4: "4242",
  holder: "SENRYO PREVIEW",
  expires: "09/29",
  route: "Sandbox card · no charge",
  dailyLimit6: 1_000_000_000n,
  spentToday6: 159_000_000n,
  resetsIn: "4h 59m",
  auths: [
    { id: "a1", merchant: "Blue Bottle Coffee", state: "hold", amount6: 6_400_000n },
    { id: "a2", merchant: "Uber", state: "hold", amount6: 23_180_000n },
    { id: "a3", merchant: "Apple Store", state: "settled", amount6: 129_000_000n },
  ] satisfies CardAuth[],
};

export const SAMPLE_QUOTE = {
  payToken: "USDC",
  payChain: "Base",
  receiveToken: "AUSD",
  receiveChain: "Monad",
  networkFee6: 420_000n,
  slippageBps: 50n,
  etaSeconds: 24,
};

export const SAMPLE_NETWORK = { name: "Monad", blockTimeLabel: "0.3s" } as const;
