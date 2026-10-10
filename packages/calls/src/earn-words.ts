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

const PRICE_SCALE = 1_000_000_000_000n;
const PCT_SCALE = 1_000_000n;
const PCT_PER_UNIT = 10_000;
const PCT_DECIMALS = 3;
const HHMM = 5;
const TIME_START = 11;
const MS = 1000;

/** Hour by hour: what a share's value did in each settled hour ("16:00 UTC · +0.012%"), newest first. */
export function hourLines(
  view: EarnView,
): { key: number; time: string; change: string; tone: "up" | "down" | "muted" }[] {
  const perShare = (h: EarnView["hours"][number]) => ((h.value + 1n) * PRICE_SCALE) / (h.supply + 1n);
  return view.hours.slice(0, -1).map((h, i) => {
    const before = view.hours[i + 1];
    const was = before ? perShare(before) : 0n;
    const pct = was === 0n ? 0 : Number(((perShare(h) - was) * PCT_SCALE) / was) / PCT_PER_UNIT;
    return {
      key: h.hour,
      time: `${new Date(h.hour * MS).toISOString().slice(TIME_START, TIME_START + HHMM)} UTC`,
      change: `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct).toFixed(PCT_DECIMALS)}%${h.deferred ? " · withdrawals waited" : ""}`,
      tone: pct > 0 ? "up" : pct < 0 ? "down" : "muted",
    };
  });
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
