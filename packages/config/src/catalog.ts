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
import type { CalendarId } from "./calendars.ts";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "./networks.ts";

export type MarketKind = "crypto" | "equity" | "metal" | "fx" | "basket";
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

/** A basket member: a listed market, its weight and its price when the basket was 1,000 points (D-286). */
export interface BasketMember {
  symbol: string;
  weightBps: number;
  baseE8: bigint;
}

/**
 * Where a market's price is proven (D-284, D-286): one Pyth feed, or a basket of listed markets in points — its
 * on-chain feed id is the hash of the definition (`BasketPrintVerifier.basketId`, re-derived by the invariant
 * `catalog-basket-ids`). RedStone joins in S7.8.
 */
export type PriceSource =
  | { kind: "pyth"; feedId: `0x${string}` }
  | { kind: "basket"; basketId: `0x${string}`; members: readonly BasketMember[] };

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
  return m.source.kind === "basket" ? m.source.basketId : m.source.feedId;
}

/** The market whose prints are keyed by this feed id (a single feed or a basket). */
export function marketByFeedId(feedId: string): MarketSpec | undefined {
  return MARKETS.find((m) => feedIdOf(m) === feedId);
}

/** A basket's members as markets, in its definition's order (empty for a single feed). */
export function basketMembers(m: MarketSpec): { member: BasketMember; market: MarketSpec }[] {
  if (m.source.kind !== "basket") return [];
  return m.source.members.map((member) => {
    const market = MARKETS.find((x) => x.symbol === member.symbol);
    if (!market) throw new Error(`${m.symbol}: member ${member.symbol} is not listed`);
    return { member, market };
  });
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
  // Baskets (D-286): equal weights, 1,000 points at the members' prints of 2026-10-09T14:00:00Z; σ measured like the
  // single markets (the basket's own 1-minute index over five days, ×1.5).
  {
    symbol: "MAJORS",
    name: "Crypto majors",
    kind: "basket",
    source: {
      kind: "basket",
      basketId: "0x4e3e3c889b6c0c7d808f86efc9bad05c5a47cd1f10fe97967a80194302a2a83c",
      members: [
        { symbol: "BTC", weightBps: 3334, baseE8: 8_255_901_409_615n },
        { symbol: "ETH", weightBps: 3333, baseE8: 248_247_898_562n },
        { symbol: "SOL", weightBps: 3333, baseE8: 10_952_339_683n },
      ],
    },
    annualVol: 0.61,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "ALTS",
    name: "Alt coins",
    kind: "basket",
    source: {
      kind: "basket",
      basketId: "0x8d72fb569fec73eed386cde5bf50b36da75cd28f167067da8ec09b8ce6c57e01",
      members: [
        { symbol: "DOGE", weightBps: 2500, baseE8: 8_440_963n },
        { symbol: "XRP", weightBps: 2500, baseE8: 137_902_450n },
        { symbol: "BNB", weightBps: 2500, baseE8: 73_843_159_515n },
        { symbol: "HYPE", weightBps: 2500, baseE8: 8_500_953_452n },
      ],
    },
    annualVol: 0.7,
    cadences: CADENCES_SEC,
    calendarId: 0,
    chains: [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID],
  },
  {
    symbol: "METALS",
    name: "Metals",
    kind: "basket",
    source: {
      kind: "basket",
      basketId: "0xac73fa5dd455b02b64be95124bb0fb1ce639e7c7301a37838166aa1432864c30",
      members: [
        { symbol: "XAU", weightBps: 5000, baseE8: 419_035_200_000n },
        { symbol: "XAG", weightBps: 5000, baseE8: 6_105_866_000n },
      ],
    },
    annualVol: 0.45,
    cadences: CADENCES_SEC,
    calendarId: 2,
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
