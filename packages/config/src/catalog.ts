/**
 * The one market catalogue (D-268): every market, its price source, its volatility, its session, its cadences and its
 * band menu, plus the pool terms and session ceilings per network. The contracts deploy (`scripts/catalog-export.mjs`
 * → `contracts/script/catalog/<chainId>.json`), the keeper, the indexer, the API and both apps read this file and
 * nothing else, so a market is added in one place.
 *
 * Order is permanent: live ticks name a market by its index here (`@senryo/live`), so markets are only ever appended
 * (invariant `catalog-append-only`).
 *
 * Pyth feed ids and schedules are Pyth's own (Hermes `/v2/price_feeds`, read with our key on 9 Oct 2026; entitled per
 * D-281; MON/USD 403, so MON waits for S9 and its labelled push feed). Volatility is stored per √second × 1e8 and
 * documented annualised (σ_sec × √(365 × 86,400)), bounded on chain by `MAX_SIGMA_E8`. The S7 markets' σ is measured
 * from five days of 1-minute closes while each market traded (public candles, 9 Oct 2026; consecutive minutes only, so
 * no overnight gap) and scaled ×1.5 — the same margin BTC, ETH and SOL carry over their measured 0.35, 0.44 and 0.53:
 * a quiet week understates tails, and an underpriced σ lets Moonshot and Range take the pool.
 */
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

export type MarketKind = "crypto" | "equity" | "metal" | "fx";
export type BandKind = "up" | "down" | "range" | "moonshot" | "crash";

/** Window lengths the terminal offers (1m · 5m · 15m · 1h); each divides one hour (contracts `CADENCE_DIVIDES_SEC`). */
export const CADENCES_SEC = [60, 300, 900, 3600] as const;
export type CadenceSec = (typeof CADENCES_SEC)[number];

/** Call timing, mirrored from contracts/src/markets/MarketTypes.sol (D-261). */
export const LOCKOUT_SEC = 20;
/** An intent's action (contracts MarketTypes.sol): open a call, or cash one out. */
export const ACTION_OPEN = 1;
export const ACTION_CLOSE = 2;
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

/** Where a market's price is proven (D-284). RedStone and baskets join in S7.8 / S7.5. */
export type PriceSource = { kind: "pyth"; feedId: `0x${string}` };

export interface MarketSpec {
  /** Catalogue symbol; on chain the series market key is these ASCII bytes, left-aligned in a bytes32. */
  symbol: string;
  name: string;
  kind: MarketKind;
  source: PriceSource;
  /** Annualised volatility the pool prices with (documentation of `sigmaE8`). */
  annualVol: number;
  cadences: readonly CadenceSec[];
  /** `CALENDARS` id; 0 = always open (crypto). */
  calendarId: CalendarId;
  chains: readonly ChainId[];
}

/** The bytes32 a market's prints are keyed by on chain and in the archive. */
export function feedIdOf(m: MarketSpec): `0x${string}` {
  return m.source.feedId;
}

// --------------------------------------------------------------------------------------------- sessions (D-289)

export type CalendarId = 0 | 1 | 2 | 3;

export interface CalendarSpec {
  name: string;
  /**
   * The feed's own Pyth schedule (`America/New_York;Mon,…,Sun;MMDD/day,…`): the price moves only while it publishes,
   * so this is the session. Dated entries cover about a year ahead; refresh from Hermes before the last one passes.
   */
  schedule: string;
}

/** Calendar ids are `MarketCalendar` ids on chain; 0 is never configured there (always open). */
export const CALENDARS: Readonly<Record<CalendarId, CalendarSpec>> = {
  0: { name: "Always open", schedule: "America/New_York;O,O,O,O,O,O,O;" },
  1: {
    name: "US stocks",
    schedule:
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0907/C,1126/C,1127/0930-1300,1224/0930-1300,1225/C,0101/C,0118/C,0215/C,0326/C,0531/C,0618/C,0705/C",
  },
  2: {
    name: "Metals",
    schedule:
      "America/New_York;0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700,C,1800-2400;0907/0000-1430&1800-2400,1126/0000-1430&1800-2400,1127/0000-1445,1224/0000-1345,1225/C,1231/0000-1700,0101/C,0118/0000-1430&1800-2400,0215/0000-1430&1800-2400,0325/0000-1700,0326/C,0531/0000-1430&1800-2400,0618/0000-1300,0705/0000-1430&1800-2400",
  },
  3: { name: "Currencies", schedule: "America/New_York;O,O,O,O,0000-1700,C,1700-2400;1224/0000-1700,1231/0000-1700" },
};

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
    source: { kind: "pyth", feedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
    annualVol: 0.5,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    kind: "crypto",
    source: { kind: "pyth", feedId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
    annualVol: 0.65,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "SOL",
    name: "Solana",
    kind: "crypto",
    source: { kind: "pyth", feedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" },
    annualVol: 0.85,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    kind: "crypto",
    source: { kind: "pyth", feedId: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c" },
    annualVol: 0.95,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "XRP",
    name: "XRP",
    kind: "crypto",
    source: { kind: "pyth", feedId: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8" },
    annualVol: 0.83,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "BNB",
    name: "BNB",
    kind: "crypto",
    source: { kind: "pyth", feedId: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f" },
    annualVol: 0.58,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "HYPE",
    name: "Hyperliquid",
    kind: "crypto",
    source: { kind: "pyth", feedId: "0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b" },
    annualVol: 0.95,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    kind: "equity",
    source: { kind: "pyth", feedId: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1" },
    annualVol: 0.84,
    cadences: CADENCES_SEC,
    calendarId: 1,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ",
    kind: "equity",
    source: { kind: "pyth", feedId: "0x9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d" },
    annualVol: 0.35,
    cadences: CADENCES_SEC,
    calendarId: 1,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "XAU",
    name: "Gold",
    kind: "metal",
    source: { kind: "pyth", feedId: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2" },
    annualVol: 0.32,
    cadences: CADENCES_SEC,
    calendarId: 2,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "XAG",
    name: "Silver",
    kind: "metal",
    source: { kind: "pyth", feedId: "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e" },
    annualVol: 0.61,
    cadences: CADENCES_SEC,
    calendarId: 2,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "EUR",
    name: "Euro",
    kind: "fx",
    source: { kind: "pyth", feedId: "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b" },
    annualVol: 0.13,
    cadences: CADENCES_SEC,
    calendarId: 3,
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

export type PrintClassKey = "crypto" | "equity";

export const PRINT_CLASSES: Readonly<Record<PrintClassKey, PrintClass>> = {
  crypto: { graceSec: 5, maxConfBps: 25, admissionSec: 300 },
  equity: { graceSec: 5, maxConfBps: 50, admissionSec: 300 },
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
};

/** Each class's verifier, by its address-book name. */
export const PRINT_VERIFIER: Readonly<Record<PrintClassKey, string>> = {
  crypto: "PythPrintVerifier",
  equity: "PythPrintVerifierEquity",
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
