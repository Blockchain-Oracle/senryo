/**
 * Your record as both apps show it (R5.20; Owarine's account stats): lifetime PnL, win rate, trades, win streak, best
 * streak and volume. The api reads them from the indexer's account, which counts every call, ride, parlay and event
 * call once it is live and realises each when it ends, in that order — so the streaks run across all of them. Win rate
 * leaves refunds out (neither won nor lost); a record with nothing decided yet reads "—". Pure.
 */

export interface StatsInput {
  /** Every trade that went live. */
  calls: number;
  /** Realised over everything that ended, e-6 as a decimal string. */
  pnl: string;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  /** Each call's stake and each ride's notional, e-6. */
  volume: bigint;
}

export interface StatsView {
  pnl: bigint;
  winRate: string;
  trades: number;
  streak: number;
  bestStreak: number;
  volume: bigint;
}

const PERCENT = 100;

export function statsView(s: StatsInput): StatsView {
  const decided = s.wins + s.losses;
  return {
    pnl: BigInt(s.pnl),
    winRate: decided > 0 ? `${Math.round((s.wins / decided) * PERCENT)}%` : "—",
    trades: s.calls,
    streak: s.streak,
    bestStreak: s.bestStreak,
    volume: s.volume,
  };
}
