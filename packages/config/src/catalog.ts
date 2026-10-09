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
import type { CadenceSec } from "./cadences.ts";
import type { CalendarId } from "./calendars.ts";
import { PYTH_BASKETS, REDSTONE_BASKETS } from "./markets/baskets.ts";
import { PYTH_MARKETS } from "./markets/pyth.ts";
import { REDSTONE_MARKETS } from "./markets/redstone.ts";
import type { ChainId } from "./networks.ts";

export type MarketKind = "crypto" | "equity" | "metal" | "fx" | "basket";
export type BandKind = "up" | "down" | "range" | "moonshot" | "crash";

/** Window lengths the terminal offers (1m · 5m · 15m · 1h); each divides one hour (contracts `CADENCE_DIVIDES_SEC`). */
export { CADENCES_SEC, type CadenceSec } from "./cadences.ts";

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
 * `catalog-basket-ids`).
 */
export type PriceSource =
  | { kind: "pyth"; feedId: `0x${string}` }
  /** RedStone's signed packages (D-284): `feed` is its data-feed id ("NVDA"), on chain its ASCII in a bytes32. */
  | { kind: "redstone"; feed: string }
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
  if (m.source.kind === "basket") return m.source.basketId;
  if (m.source.kind === "redstone") return asciiBytes32(m.source.feed);
  return m.source.feedId;
}

const HEX_RADIX = 16;
const BYTE_HEX = 2;
const BYTES32_HEX = 64;

/** ASCII left-aligned in a bytes32, as RedStone names a feed (`bytes32("NVDA")`). */
export function asciiBytes32(text: string): `0x${string}` {
  const hex = [...text].map((c) => c.charCodeAt(0).toString(HEX_RADIX).padStart(BYTE_HEX, "0")).join("");
  return `0x${hex.padEnd(BYTES32_HEX, "0")}`;
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

/**
 * Every market, in its permanent order (live ticks name a market by its index; `catalog-append-only`): the Pyth feeds,
 * the Pyth baskets, then RedStone's feeds and baskets (D-284, D-286). The data lives per source in `./markets/`.
 */
export const MARKETS: readonly MarketSpec[] = [
  ...PYTH_MARKETS,
  ...PYTH_BASKETS,
  ...REDSTONE_MARKETS,
  ...REDSTONE_BASKETS,
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
