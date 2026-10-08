import type { Account, DailyAccountStat, Market, Pool, Ticket } from "envio";

/**
 * Ids, defaults and the account bookkeeping shared by the handlers. A call counts once it fills (a refused call never
 * touches an account); its result is realised when it finishes — fully cashed out, or settled — as everything it
 * returned (proceeds, payout, refund) minus its original stake.
 */
export const SECONDS_PER_DAY = 86_400;
/** Band slots kept per window for the crowd split (contracts `MAX_BANDS`). */
export const BAND_SLOTS = 8;

export const key = (chainId: number, id: string | bigint) => `${chainId}_${String(id).toLowerCase()}`;

export function newAccount(chainId: number, owner: string): Account {
  return {
    id: key(chainId, owner),
    chainId,
    owner,
    calls: 0,
    staked: 0n,
    returned: 0n,
    pnl: 0n,
    wins: 0,
    losses: 0,
    refunds: 0,
    streak: 0,
    bestStreak: 0,
    lastActiveAt: 0,
  };
}

export function newDaily(chainId: number, owner: string, day: number): DailyAccountStat {
  return { id: `${key(chainId, owner)}_${day}`, chainId, owner, day, calls: 0, wins: 0, staked: 0n, pnl: 0n };
}

export function newMarket(chainId: number, seriesId: string): Market {
  return {
    id: key(chainId, seriesId),
    chainId,
    seriesId,
    marketKey: "",
    cadenceSec: 0,
    calls: 0,
    volume: 0n,
    paidOut: 0n,
  };
}

export function newPool(chainId: number): Pool {
  return {
    id: String(chainId),
    chainId,
    funded: 0n,
    defunded: 0n,
    settledToPool: 0n,
    settledToHolders: 0n,
    heldPayouts: 0n,
  };
}

export type Outcome = "win" | "lose" | "refund";

/** What a finished ticket returned in all, and the realised result against its original stake. */
export function realised(t: Ticket): { returned: bigint; pnl: bigint } {
  const returned = t.proceeds + t.paid + t.refunded;
  return { returned, pnl: returned - t.originalStake };
}

/** Applies a finished ticket to its account: realised PnL, the win/loss/refund tally and the streak. */
export function finishOnAccount(a: Account, pnl: bigint, outcome: Outcome, at: number): Account {
  const streak = outcome === "win" ? a.streak + 1 : outcome === "lose" ? 0 : a.streak;
  return {
    ...a,
    pnl: a.pnl + pnl,
    wins: a.wins + (outcome === "win" ? 1 : 0),
    losses: a.losses + (outcome === "lose" ? 1 : 0),
    refunds: a.refunds + (outcome === "refund" ? 1 : 0),
    streak,
    bestStreak: Math.max(a.bestStreak, streak),
    lastActiveAt: Math.max(a.lastActiveAt, at),
  };
}

export const dayOf = (timestamp: number) => Math.floor(timestamp / SECONDS_PER_DAY);
