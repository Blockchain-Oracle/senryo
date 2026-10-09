/**
 * Per-network terms (D-262, D-264, D-267, D-284): how a print is proven (one verifier per class), Pyth's receivers,
 * the pool's pricing and caps, and the chain's session ceilings.
 */
import { basketMembers, type MarketSpec } from "./catalog.ts";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

/** How a Pyth print is proven (contracts `PythPrintVerifier` immutables): one verifier per quality class. */
export interface PrintClass {
  graceSec: number;
  maxConfBps: number;
  admissionSec: number;
}

/** Pyth's classes (by market kind), Pyth baskets, RedStone's single feeds and RedStone baskets (D-284, D-286). */
export type PrintClassKey = "crypto" | "equity" | "basket" | "redstone" | "redstone-basket";
export type PythClassKey = "crypto" | "equity" | "basket";

export const PRINT_CLASSES: Readonly<Record<PythClassKey, PrintClass>> = {
  crypto: { graceSec: 5, maxConfBps: 25, admissionSec: 300 },
  equity: { graceSec: 5, maxConfBps: 50, admissionSec: 300 },
  /** Every member of a basket meets crypto's bound (metals quote far inside it). */
  basket: { graceSec: 5, maxConfBps: 25, admissionSec: 300 },
};

/**
 * RedStone (D-284): `redstone-primary-prod`'s five production signers (the gateway's and `PrimaryProdDataServiceConsumer
 * Base`'s, recovered from live packages 9 Oct 2026); all five while a grid point is under a minute old, three after;
 * prints admitted for 15 minutes (its gateway keeps about a day).
 */
export const REDSTONE = {
  signers: [
    "0x8BB8F32Df04c8b654987DAaeD53D6B6091e3B774",
    "0xdEB22f54738d54976C4c0fe5ce6d408E40d88499",
    "0x51Ce04Be4b3E32572C4Ec9135221d0691Ba7d202",
    "0xDD682daEC5A90dD295d14DA4b0bec9281017b5bE",
    "0x9c5AE89C4Af6aA32cE58588DBaF90d18a855B6de",
  ],
  threshold: 3,
  strictSec: 60,
  admissionSec: 900,
  /** The signing grid: a print of t is the first grid point at or after t. */
  gridSec: 10,
} as const;

/** A market's print class: by its source, and for Pyth by kind (metals and the euro quote inside crypto's bound). */
export function printClassKeyOf(m: MarketSpec): PrintClassKey {
  if (m.source.kind === "redstone") return "redstone";
  if (m.source.kind === "basket") {
    const sources = new Set(basketMembers(m).map((x) => x.market.source.kind));
    if (sources.size !== 1) throw new Error(`${m.symbol}: a basket's members share one source`);
    return sources.has("redstone") ? "redstone-basket" : "basket";
  }
  return m.kind === "equity" ? "equity" : "crypto";
}

/** Seconds after `t` a print for `t` may still be recorded (after that the window voids). */
export function admissionSecOf(m: MarketSpec): number {
  const k = printClassKeyOf(m);
  return k === "redstone" || k === "redstone-basket" ? REDSTONE.admissionSec : PRINT_CLASSES[k].admissionSec;
}

/** Each class's verifier, by its address-book name. */
export const PRINT_VERIFIER: Readonly<Record<PrintClassKey, string>> = {
  crypto: "PythPrintVerifier",
  equity: "PythPrintVerifierEquity",
  basket: "BasketPrintVerifier",
  redstone: "RedStonePrintVerifier",
  "redstone-basket": "RedStoneBasketVerifier",
};

/** Pyth Core receivers. Mainnet: Pyth's own table; both candidates verified a keyed boundary payload on 8 Oct (D-274). */
export const PYTH_RECEIVER: Readonly<Record<ChainId, `0x${string}`>> = {
  [TESTNET_CHAIN_ID]: "0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379",
  [MAINNET_CHAIN_ID]: "0xB754BA51E3861Ac0Cb67f73CD046dE790A36508d",
};

/** Dollars are 6-decimal on both networks (Test USD, Circle USDC). */
const USD = 1_000_000;

/** The pool's terms (contracts `Params`, D-262/D-264) and the chain's session ceilings (D-267). */
export interface PoolTerms {
  halfSpreadE6: number;
  maxSurchargeE6: number;
  minProbE6: number;
  maxProbE6: number;
  maxExposureBps: number;
  maxExpiryReserved: bigint;
  minStake: bigint;
  maxStake: bigint;
  session: { perCallCap: bigint; sessionCap: bigint; maxSessionSec: number };
}

const PRICING = {
  halfSpreadE6: 20_000,
  maxSurchargeE6: 10_000,
  minProbE6: 30_000,
  maxProbE6: 970_000,
  maxExposureBps: 6000,
} as const;

export const POOL_TERMS: Readonly<Record<ChainId, PoolTerms>> = {
  [TESTNET_CHAIN_ID]: {
    ...PRICING,
    maxExpiryReserved: BigInt(500_000 * USD),
    minStake: BigInt(USD),
    maxStake: BigInt(1000 * USD),
    session: { perCallCap: BigInt(1000 * USD), sessionCap: BigInt(10_000 * USD), maxSessionSec: 3600 },
  },
  [MAINNET_CHAIN_ID]: {
    ...PRICING,
    // Sized to the seed at S9; a fraction of a small pool so one print never decides much of it.
    maxExpiryReserved: BigInt(250 * USD),
    minStake: BigInt(USD),
    maxStake: BigInt(25 * USD),
    session: { perCallCap: BigInt(25 * USD), sessionCap: BigInt(100 * USD), maxSessionSec: 900 },
  },
};

/** Practice's pool seed in Test USD (minted at deploy; D-260). */
export const TESTNET_POOL_SEED = BigInt(10_000_000 * USD);
