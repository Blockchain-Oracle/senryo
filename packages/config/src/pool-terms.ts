/**
 * Per-network terms (D-262, D-264, D-267, D-284): how a print is proven (one verifier per class), Pyth's receivers,
 * the pool's pricing and caps, and the chain's session ceilings.
 */
import type { MarketKind, MarketSpec } from "./catalog.ts";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

/** How a print is proven (contracts `PythPrintVerifier` immutables): one verifier per quality class. */
export interface PrintClass {
  graceSec: number;
  maxConfBps: number;
  admissionSec: number;
}

export type PrintClassKey = "crypto" | "equity" | "basket";

export const PRINT_CLASSES: Readonly<Record<PrintClassKey, PrintClass>> = {
  crypto: { graceSec: 5, maxConfBps: 25, admissionSec: 300 },
  equity: { graceSec: 5, maxConfBps: 50, admissionSec: 300 },
  /** Every member of a basket meets crypto's bound (metals quote far inside it). */
  basket: { graceSec: 5, maxConfBps: 25, admissionSec: 300 },
};

/**
 * Metals and the euro quote far inside crypto's 25 bps (0.3–2 bps measured 9 Oct), so they share its verifier; a stock
 * gets the wider equity class (its open can print a wide band).
 */
export const PRINT_CLASS_OF: Readonly<Record<MarketKind, PrintClassKey>> = {
  crypto: "crypto",
  metal: "crypto",
  fx: "crypto",
  equity: "equity",
  basket: "basket",
};

/** Each class's verifier, by its address-book name. */
export const PRINT_VERIFIER: Readonly<Record<PrintClassKey, string>> = {
  crypto: "PythPrintVerifier",
  equity: "PythPrintVerifierEquity",
  basket: "BasketPrintVerifier",
};

export function printClassOf(m: MarketSpec): PrintClass {
  return PRINT_CLASSES[PRINT_CLASS_OF[m.kind]];
}

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
