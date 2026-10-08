/**
 * The one market catalogue (D-268): every market, its Pyth feed, its volatility, its cadences and its band menu, plus
 * the pool terms and session ceilings per network. The contracts deploy (`scripts/catalog-export.mjs` →
 * `contracts/script/catalog/<chainId>.json`), the keeper, the indexer, the API and both apps read this file and nothing
 * else, so a market is added in one place.
 *
 * Pyth feed ids are Pyth's own (pyth.network/developers/price-feed-ids, checked 8 Oct 2026 against Hermes with our key:
 * BTC, ETH, SOL entitled; MON/USD 403, so MON waits for S9 and its labelled push feed). Volatility is annualised and
 * stored per √second × 1e8 (σ / √(365 × 86,400)), bounded on chain by `MAX_SIGMA_E8`.
 */
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

export type MarketKind = "crypto" | "equity";
export type BandKind = "up" | "down" | "range" | "moonshot" | "crash";

/** Window lengths the terminal offers (1m · 5m · 15m · 1h); each divides one hour (contracts `CADENCE_DIVIDES_SEC`). */
export const CADENCES_SEC = [60, 300, 900, 3600] as const;
export type CadenceSec = (typeof CADENCES_SEC)[number];

/** Call timing, mirrored from contracts/src/markets/MarketTypes.sol (D-261). */
export const LOCKOUT_SEC = 20;
export const FILL_DELAY_SEC = 1;
export const MIN_HOLD_SEC = 3;
/** Most tickets one `finalize`, `expire` or `claimFor` takes. */
export const MARKET_BATCH_MAX = 32;

/** Mirrors `BAND_*` in contracts/src/markets/MarketTypes.sol. */
export const BAND_KIND_CODE: Readonly<Record<BandKind, number>> = { up: 1, down: 2, range: 3, moonshot: 4, crash: 5 };

/** Menu positions are permanent on chain (tickets name a band by index), so this order never changes. */
export const BAND_INDEX = { up: 0, down: 1, range: 2, moonshot: 3, crash: 4 } as const;

export interface BandSpec {
  kind: BandKind;
  /** Range: below K. Moonshot / Crash: the strike's distance from K. Basis points of K. */
  lowBps: number;
  /** Range: above K. */
  highBps: number;
}

export interface MarketSpec {
  /** Catalogue symbol; on chain the series market key is these ASCII bytes, left-aligned in a bytes32. */
  symbol: string;
  name: string;
  kind: MarketKind;
  pythFeedId: `0x${string}`;
  /** Annualised volatility the pool prices with (documentation of `sigmaE8`). */
  annualVol: number;
  cadences: readonly CadenceSec[];
  /** MarketCalendar id; 0 = always open (crypto). */
  calendarId: number;
  chains: readonly ChainId[];
}

const SECONDS_PER_YEAR = 365 * 86_400;
const E8 = 100_000_000;
const BPS = 10_000;
/** A range spans ±½σ√τ around K; a moonshot or crash strike sits 1σ√τ out (each at least 1 bp). */
const RANGE_SIGMAS = 0.5;
const STRIKE_SIGMAS = 1;

export const MARKETS: readonly MarketSpec[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    kind: "crypto",
    pythFeedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    annualVol: 0.5,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    kind: "crypto",
    pythFeedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    annualVol: 0.65,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "SOL",
    name: "Solana",
    kind: "crypto",
    pythFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    annualVol: 0.85,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
];

/** σ per √second × 1e8 (the contracts' `sigmaE8`). */
export function sigmaE8Of(m: MarketSpec): number {
  return Math.round((m.annualVol / Math.sqrt(SECONDS_PER_YEAR)) * E8);
}

/** σ√τ over one window, in basis points of the price. */
export function windowSigmaBps(m: MarketSpec, cadence: CadenceSec): number {
  return (sigmaE8Of(m) / E8) * Math.sqrt(cadence) * BPS;
}

/** The series' fixed menu, in on-chain order (`BAND_INDEX`). */
export function bandMenu(m: MarketSpec, cadence: CadenceSec): BandSpec[] {
  const s = windowSigmaBps(m, cadence);
  const half = Math.max(1, Math.round(s * RANGE_SIGMAS));
  const strike = Math.max(1, Math.round(s * STRIKE_SIGMAS));
  return [
    { kind: "up", lowBps: 0, highBps: 0 },
    { kind: "down", lowBps: 0, highBps: 0 },
    { kind: "range", lowBps: half, highBps: half },
    { kind: "moonshot", lowBps: strike, highBps: 0 },
    { kind: "crash", lowBps: strike, highBps: 0 },
  ];
}

export function marketsOn(chainId: ChainId): MarketSpec[] {
  return MARKETS.filter((m) => m.chains.includes(chainId));
}

// --------------------------------------------------------------------------------------------- per-network terms

/** How a print is proven (contracts `PythPrintVerifier` immutables): one verifier per quality class. */
export interface PrintClass {
  graceSec: number;
  maxConfBps: number;
  admissionSec: number;
}

export const PRINT_CLASSES: Readonly<Record<MarketKind, PrintClass>> = {
  crypto: { graceSec: 5, maxConfBps: 25, admissionSec: 300 },
  equity: { graceSec: 5, maxConfBps: 50, admissionSec: 300 },
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
