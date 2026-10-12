/**
 * Earn in words, both apps (S7.6, D-287): what you hold in the pool, what the pool holds, when the next hour settles,
 * what you've asked for, and the risk said plainly — never an APY.
 */
import type { EarnView } from "@senryo/api-client";
import { clockText, formatUnits } from "@senryo/core";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const BPS_PER_PERCENT = 100;
const BPS = 10_000n;
const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

export interface EarnWords {
  hero: string;
  heroDetail: string;
  pool: string;
  ready: string;
  next: string;
  supplying: string | null;
  withdrawing: string | null;
  risk: string;
}

/** Before the pool is on chain: what Earn is, so the page isn't a bare line (R2 simulator pass). */
export const EARN_NOT_OPEN = {
  title: "Earn isn't open yet.",
  detail:
    "Earn lets you supply dollars to the pool that takes the other side of every call. Your share rises and falls " +
    "with the pool, so you can get back less than you put in; withdrawals settle on the hour.",
} as const;

/** Dollars of shares → shares at the pool's price (rounded down), for a withdrawal entered in dollars. */
export function sharesFor(dollars: bigint, pool: NonNullable<EarnView["pool"]>): bigint {
  return pool.value === 0n ? 0n : (dollars * (pool.supply + 1n)) / (pool.value + 1n);
}

export function earnWords(view: EarnView, nowSec: number): EarnWords | null {
  const pool = view.pool;
  if (!view.deployed || !pool) return null;
  const a = view.account;
  const held = a?.value ?? 0n;
  const share = pool.value > 0n && held > 0n ? Number((held * BPS) / pool.value) / BPS_PER_PERCENT : 0;
  return {
    hero: usd(held),
    heroDetail: held > 0n ? `${share.toFixed(2)}% of the pool` : "Supply the pool to earn what it keeps",
    pool: `Pool ${usd(pool.value)}`,
    ready: `${usd(pool.liquid)} ready · ${usd(pool.reserved)} backing open calls`,
    next: `Next hour settles in ${clockText(Math.max(0, pool.nextRoll - nowSec))}`,
    supplying:
      a && a.supply.amount > 0n
        ? a.supply.settled
          ? `${usd(a.supply.amount)} supplied · arriving as shares`
          : `Supplying ${usd(a.supply.amount)} at the next hour`
        : null,
    withdrawing:
      a && a.withdraw.amount > 0n
        ? a.withdraw.settled
          ? "Withdrawal settled · dollars arriving"
          : "Withdrawing at the next hour the pool can pay"
        : null,
    risk:
      `The pool takes the other side of every call: it keeps what losing calls staked and pays winning ones, with a ` +
      `small spread as its edge. Your share rises and falls with it, so you can get back less than you put in. At ` +
      `most ${pool.maxExposureBps / BPS_PER_PERCENT}% of the pool backs open calls; the rest is ready for withdrawals, ` +
      `which settle on the hour once that hour's calls are settled.`,
  };
}

const SHARE_SCALE = 1_000_000_000_000n;
const SHARE_SCALE_DECIMALS = 12;
const SHARE_SHOWN_DECIMALS = 6;

/** One pool share's value in dollars × 1e12 (P5; shares and dollars both count six decimals, D-287's offset). */
export function sharePriceE12(p: { value: bigint; supply: bigint }): bigint {
  return ((p.value + 1n) * SHARE_SCALE) / (p.supply + 1n);
}

/** "$1.000312". */
export const sharePriceText = (e12: bigint) => `$${formatUnits(e12, SHARE_SCALE_DECIMALS, SHARE_SHOWN_DECIMALS)}`;

/** Where a share value sits on the chart (a coordinate, not money: the line is drawn in floating point). */
export const plotValue = (e12: bigint) => Number(e12) / Number(SHARE_SCALE);

export interface SharePoint {
  hour: number;
  e12: bigint;
}

/** A share's value hour by hour, oldest first, closed by its value now (P5's chart plots this, never deposits). */
export function shareSeries(view: EarnView, nowSec: number): SharePoint[] {
  const past = [...view.hours].reverse().map((h) => ({ hour: h.hour, e12: sharePriceE12(h) }));
  return view.pool ? [...past, { hour: nowSec, e12: sharePriceE12(view.pool) }] : past;
}

const SECONDS_PER_HOUR = 3600;
const HOURS_PER_DAY = 24;
/** The return in percent × 1e6 (integer), shown to four places. */
const PCT_SCALE = 100_000_000n;
const PCT_SCALE_DECIMALS = 6;
const RETURN_DECIMALS = 4;

/** What a share did over the series ("+0.0012%"), and how far back that reaches: the range, or since launch. */
export function seriesReturn(
  series: readonly SharePoint[],
  rangeHours: number,
): { change: string; tone: "up" | "down" | "muted"; label: string } | null {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last || series.length < 2 || first.e12 === 0n) return null;
  const move = ((last.e12 - first.e12) * PCT_SCALE) / first.e12;
  const hours = Math.round((last.hour - first.hour) / SECONDS_PER_HOUR);
  const span = hours >= 2 * HOURS_PER_DAY ? `${Math.round(hours / HOURS_PER_DAY)} d` : `${hours} h`;
  const abs = move < 0n ? -move : move;
  return {
    change: `${move > 0n ? "+" : move < 0n ? "−" : ""}${formatUnits(abs, PCT_SCALE_DECIMALS, RETURN_DECIMALS)}%`,
    tone: move > 0n ? "up" : move < 0n ? "down" : "muted",
    label: hours + 1 < rangeHours ? `Since launch · ${span}` : `Last ${span}`,
  };
}

/** The share chart's floor on its vertical span: a tiny move draws as the near-flat line it is (P5: never exaggerate). */
const MIN_SPAN = 0.0005;

/** Values the chart's range must include, so its height never makes a basis-point drift look like a cliff. */
export function shareChartBounds(series: readonly SharePoint[]): number[] {
  const last = series[series.length - 1];
  const mid = last ? plotValue(last.e12) : 1;
  return [mid * (1 - MIN_SPAN), mid * (1 + MIN_SPAN)];
}

/** What a withdrawal of `shares` is worth now (the pool's price, rounded down). */
const sharesValue = (shares: bigint, pool: { value: bigint; supply: bigint }) =>
  (shares * (pool.value + 1n)) / (pool.supply + 1n);

/** Everything the account holds in Earn now: its shares, a supply waiting for its hour, a withdrawal waiting. */
export function earnHeld(view: EarnView): bigint {
  const a = view.account;
  if (!a || !view.pool) return 0n;
  const waitingSupply = a.supply.settled ? 0n : a.supply.amount;
  return a.value + waitingSupply + sharesValue(a.withdraw.amount, view.pool);
}

/** Net earned (P5): what's held now, plus what withdrawals paid out, less what went in; null until it's indexed. */
export function netEarned(view: EarnView): bigint | null {
  const basis = view.account?.basis;
  return basis ? earnHeld(view) + basis.paidOut - basis.paidIn : null;
}

/** The pool's state as a panel: how full its backing is against the cap, and the words for each figure. */
export function poolPanel(pool: NonNullable<EarnView["pool"]>, nowSec: number) {
  const used = pool.value > 0n ? Number((pool.reserved * BPS) / pool.value) : 0;
  return {
    total: usd(pool.value),
    available: usd(pool.liquid),
    backing: usd(pool.reserved),
    /** Reserved over value, and the cap it can't pass (both in bps). */
    usedBps: used,
    capBps: pool.maxExposureBps,
    usedText: `${(used / BPS_PER_PERCENT).toFixed(1)}% of the pool · cap ${pool.maxExposureBps / BPS_PER_PERCENT}%`,
    next: `Next hour settles in ${clockText(Math.max(0, pool.nextRoll - nowSec))}`,
  };
}

/** The keypad sheet's estimate: about how many shares a supply buys, or about what a withdrawal pays, at today's price. */
export function estimateLine(side: "supply" | "withdraw", amount: bigint, pool: NonNullable<EarnView["pool"]>): string {
  if (amount === 0n) return side === "supply" ? "Shares arrive at the next hour" : "Dollars arrive at the next hour";
  if (side === "supply") {
    const shares = (amount * (pool.supply + 1n)) / (pool.value + 1n);
    return `About ${formatUnits(shares, DOLLAR_DECIMALS, CENTS)} shares at ${sharePriceText(sharePriceE12(pool))}`;
  }
  return `About ${usd(amount)} at the next hour the pool can pay`;
}

/** The risk said by the action, in one sentence (P5). */
export const EARN_RISK = "The pool pays winning calls. Your share can fall, and withdrawals can wait.";
