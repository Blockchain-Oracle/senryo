import type { LeaderboardPeriod } from "@senryo/api-client";
import { SECONDS_PER_DAY } from "@senryo/service-common";
import {
  DAYS_PER_WEEK,
  EPOCH_DAY_AFTER_MONDAY,
  OPENING_FILL_KINDS,
  ROLLING_WINDOW_SEC,
  WINDOW_DAYS,
} from "./constants.ts";

/**
 * Leaderboard arithmetic (S12b.5, §5.9). Pure: no DB, no I/O, so the social check runs it on seeded rows.
 * Metric: realized PnL after fees, funding and borrow (usd6), the same identity on every source:
 * - a fill: `realizedPnl − fee − funding − borrow` (funding is signed, positive = paid by the trader);
 * - a UTC-day bucket: `realizedPnl − fees − funding` (the indexer folds borrow into the day's funding);
 * - lifetime totals: `realizedPnl − feesPaid − fundingPaid − borrowPaid` (= Σ day buckets, same indexer handler).
 * A trader with no indexed activity in the window has no totals at all — never a fabricated zero.
 */

export interface Totals {
  netPnl: bigint;
  notional: bigint;
  trades: number;
}

export interface FillLike {
  user_id: string;
  realizedPnl: bigint;
  fee: bigint;
  funding: bigint;
  borrow: bigint;
  notional: bigint;
  timestamp: number;
}

export interface DayLike {
  user_id: string;
  day: number;
  realizedPnl: bigint;
  fees: bigint;
  funding: bigint;
  volume: bigint;
  trades: number;
}

export interface LifetimeLike {
  id: string;
  realizedPnl: bigint;
  feesPaid: bigint;
  fundingPaid: bigint;
  borrowPaid: bigint;
  volume: bigint;
  tradeCount: number;
}

export interface Floor {
  minTrades: number;
  minNotionalUsd6: bigint;
}

export interface Window {
  kind: "rolling" | "utc_days" | "lifetime";
  /** Inclusive start (unix s); null for lifetime. */
  fromSec: number | null;
  toSec: number;
  /** First UTC day index of a day-bucket window. */
  sinceDay: number | null;
}

export const netOfFill = (f: FillLike): bigint => f.realizedPnl - f.fee - f.funding - f.borrow;
export const netOfDay = (d: DayLike): bigint => d.realizedPnl - d.fees - d.funding;
export const netOfLifetime = (u: LifetimeLike): bigint => u.realizedPnl - u.feesPaid - u.fundingPaid - u.borrowPaid;

/** UTC day index (indexer `dayOf`). */
export const dayOf = (sec: number): number => Math.floor(sec / SECONDS_PER_DAY);

export function windowOf(period: LeaderboardPeriod, nowSec: number): Window {
  if (period === "24h") return { kind: "rolling", fromSec: nowSec - ROLLING_WINDOW_SEC, toSec: nowSec, sinceDay: null };
  if (period === "all") return { kind: "lifetime", fromSec: null, toSec: nowSec, sinceDay: null };
  const sinceDay = dayOf(nowSec) - (WINDOW_DAYS[period] - 1);
  return { kind: "utc_days", fromSec: sinceDay * SECONDS_PER_DAY, toSec: nowSec, sinceDay };
}

/** Monday 00:00 UTC of the week containing `nowSec`. */
export function weekStartSec(nowSec: number): number {
  const day = dayOf(nowSec);
  return (day - ((day + EPOCH_DAY_AFTER_MONDAY) % DAYS_PER_WEEK)) * SECONDS_PER_DAY;
}

function add(map: Map<string, Totals>, user: string, net: bigint, notional: bigint, trades: number): void {
  const t = map.get(user) ?? { netPnl: 0n, notional: 0n, trades: 0 };
  map.set(user, { netPnl: t.netPnl + net, notional: t.notional + notional, trades: t.trades + trades });
}

/** Rolling window: fills with `fromSec ≤ timestamp ≤ toSec`, one trade each. */
export function sumFills(rows: readonly FillLike[], fromSec: number, toSec: number): Map<string, Totals> {
  const out = new Map<string, Totals>();
  for (const f of rows) {
    if (f.timestamp >= fromSec && f.timestamp <= toSec) add(out, f.user_id, netOfFill(f), f.notional, 1);
  }
  return out;
}

/** Day buckets from `sinceDay` (inclusive) on. */
export function sumDays(rows: readonly DayLike[], sinceDay: number): Map<string, Totals> {
  const out = new Map<string, Totals>();
  for (const d of rows) if (d.day >= sinceDay) add(out, d.user_id, netOfDay(d), d.volume, d.trades);
  return out;
}

export function sumLifetime(rows: readonly LifetimeLike[]): Map<string, Totals> {
  const out = new Map<string, Totals>();
  for (const u of rows) if (u.tradeCount > 0) add(out, u.id, netOfLifetime(u), u.volume, u.tradeCount);
  return out;
}

export const meetsFloor = (t: Totals, floor: Floor): boolean =>
  t.trades >= floor.minTrades && t.notional >= floor.minNotionalUsd6;

export interface RankedRow {
  address: string;
  rank: number;
  totals: Totals;
}

export type StandingRow =
  | { status: "ranked"; rank: number; totals: Totals }
  | { status: "below_floor"; rank: null; totals: Totals }
  | { status: "no_activity"; rank: null; totals: null };

export const NO_ACTIVITY: StandingRow = { status: "no_activity", rank: null, totals: null };

/** Best net PnL first; ties by more notional, then address (deterministic, no shared ranks). */
export function compareTotals(a: { address: string; totals: Totals }, b: { address: string; totals: Totals }): number {
  if (a.totals.netPnl !== b.totals.netPnl) return a.totals.netPnl > b.totals.netPnl ? -1 : 1;
  if (a.totals.notional !== b.totals.notional) return a.totals.notional > b.totals.notional ? -1 : 1;
  return a.address < b.address ? -1 : a.address > b.address ? 1 : 0;
}

/**
 * Rank everyone at or above the floor; everyone else with activity is `below_floor` (rank null, "Not ranked");
 * accounts absent from `totals` are `no_activity` (read them with `standings.get(a) ?? NO_ACTIVITY`).
 */
export function rankTotals(
  totals: ReadonlyMap<string, Totals>,
  floor: Floor,
): { ranked: RankedRow[]; standings: Map<string, StandingRow> } {
  const standings = new Map<string, StandingRow>();
  const eligible: Array<{ address: string; totals: Totals }> = [];
  for (const [address, t] of totals) {
    if (t.trades === 0) continue;
    if (meetsFloor(t, floor)) eligible.push({ address, totals: t });
    else standings.set(address, { status: "below_floor", rank: null, totals: t });
  }
  eligible.sort(compareTotals);
  const ranked = eligible.map((e, i) => ({ address: e.address, rank: i + 1, totals: e.totals }));
  for (const r of ranked) standings.set(r.address, { status: "ranked", rank: r.rank, totals: r.totals });
  return { ranked, standings };
}

// ---------------------------------------------------------------- weekly Top Trades

export interface ClosedLike {
  id: string;
  user_id: string;
  realizedPnl: bigint;
  feesPaid: bigint;
  fundingPaid: bigint;
  borrowPaid: bigint;
  closedAt: number | undefined;
  fills: ReadonlyArray<{ kind: string; notional: bigint; txHash: string }>;
}

export interface TopTradePick<P extends ClosedLike> {
  position: P;
  netPnl: bigint;
  notional: bigint;
  closeTxHash: string | null;
}

/**
 * The best closed position per trader (net > 0, opened notional ≥ `minNotional`, closed at or after the trader's
 * sharing start and the week start), best first, at most `max`.
 */
export function pickTopTrades<P extends ClosedLike>(
  positions: readonly P[],
  sharingSince: ReadonlyMap<string, number>,
  weekStart: number,
  minNotional: bigint,
  max: number,
): TopTradePick<P>[] {
  const best = new Map<string, TopTradePick<P>>();
  for (const p of positions) {
    const since = sharingSince.get(p.user_id);
    if (since === undefined || p.closedAt === undefined || p.closedAt < Math.max(since, weekStart)) continue;
    const netPnl = p.realizedPnl - p.feesPaid - p.fundingPaid - p.borrowPaid;
    const notional = p.fills.filter((f) => OPENING_FILL_KINDS.has(f.kind)).reduce((s, f) => s + f.notional, 0n);
    if (netPnl <= 0n || notional < minNotional) continue;
    const pick = { position: p, netPnl, notional, closeTxHash: p.fills.at(-1)?.txHash ?? null };
    const held = best.get(p.user_id);
    if (!held || netPnl > held.netPnl) best.set(p.user_id, pick);
  }
  return [...best.values()]
    .sort((a, b) => (a.netPnl === b.netPnl ? (a.position.id < b.position.id ? -1 : 1) : a.netPnl > b.netPnl ? -1 : 1))
    .slice(0, max);
}
