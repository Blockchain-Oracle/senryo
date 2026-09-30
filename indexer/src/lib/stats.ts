/**
 * Aggregates are computed in handlers (Envio Cloud exposes no `_aggregate`). Each updater reads the row (or its zero
 * value), applies a patch built from the current row, and writes it back — writes are visible to later reads in the
 * same batch, so several updaters may touch one row within a handler.
 */
import type { LpPoolDaily, MarketDailyStats, ProtocolDailyStats, ProtocolStats, UserDailyStats } from "envio";
import { GLOBAL_ID } from "./constants.ts";
import type { Ctx, Meta } from "./meta.ts";

type Patch<T> = (row: T) => Partial<T>;

function emptyProtocol(timestamp: number): ProtocolStats {
  return {
    id: GLOBAL_ID,
    users: 0,
    depositors: 0,
    traders: 0,
    deposits: 0n,
    withdrawals: 0n,
    volumeOurs: 0n,
    volumePerplApp: 0n,
    perplVolumeAll: 0n,
    builderVolume: 0n,
    trades: 0,
    fees: 0n,
    liquidations: 0,
    insuranceCovered: 0n,
    socialized: 0n,
    cardHoldsPlaced: 0,
    cardHeld: 0n,
    cardSpent: 0n,
    cardRefunded: 0n,
    vouchersAdded: 0,
    vouchersRedeemed: 0,
    starterClaims: 0,
    lpShares: 0n,
    lpDeposited: 0n,
    lpRedeemed: 0n,
    oracleRounds: 0,
    perplFillsAttributed: 0,
    unattributedFills: 0,
    pausedUntil: undefined,
    settleOnly: false,
    updatedAt: timestamp,
  };
}

function emptyProtocolDaily(day: number): ProtocolDailyStats {
  return {
    id: String(day),
    day,
    newUsers: 0,
    activeUsers: 0,
    deposits: 0n,
    withdrawals: 0n,
    volume: 0n,
    trades: 0,
    fees: 0n,
    liquidations: 0,
    cardSpend: 0n,
    cardHolds: 0,
    lpDeposits: 0n,
    lpRedeems: 0n,
  };
}

export async function updateProtocol(ctx: Ctx, meta: Meta, patch: Patch<ProtocolStats>): Promise<void> {
  const row = (await ctx.ProtocolStats.get(GLOBAL_ID)) ?? emptyProtocol(meta.timestamp);
  ctx.ProtocolStats.set({ ...row, ...patch(row), updatedAt: meta.timestamp });
}

export async function updateProtocolDaily(ctx: Ctx, meta: Meta, patch: Patch<ProtocolDailyStats>): Promise<void> {
  const row = (await ctx.ProtocolDailyStats.get(String(meta.day))) ?? emptyProtocolDaily(meta.day);
  ctx.ProtocolDailyStats.set({ ...row, ...patch(row) });
}

/** Also counts the user as active that day the first time a daily row appears. */
export async function updateUserDaily(ctx: Ctx, meta: Meta, userId: string, patch: Patch<UserDailyStats>) {
  const id = `${userId}-${meta.day}`;
  const existing = await ctx.UserDailyStats.get(id);
  const row: UserDailyStats = existing ?? {
    id,
    user_id: userId,
    day: meta.day,
    realizedPnl: 0n,
    fees: 0n,
    funding: 0n,
    volume: 0n,
    trades: 0,
    deposits: 0n,
    withdrawals: 0n,
    cardSpend: 0n,
    equity: undefined,
  };
  ctx.UserDailyStats.set({ ...row, ...patch(row) });
  if (!existing) await updateProtocolDaily(ctx, meta, (d) => ({ activeUsers: d.activeUsers + 1 }));
}

export async function updateMarketDaily(ctx: Ctx, meta: Meta, marketId: string, patch: Patch<MarketDailyStats>) {
  const id = `${marketId}-${meta.day}`;
  const row: MarketDailyStats = (await ctx.MarketDailyStats.get(id)) ?? {
    id,
    market_id: marketId,
    day: meta.day,
    volume: 0n,
    trades: 0,
    appVolume: 0n,
    fees: 0n,
    liquidations: 0,
    longSize: 0n,
    shortSize: 0n,
  };
  ctx.MarketDailyStats.set({ ...row, ...patch(row) });
}

export async function updateLpDaily(ctx: Ctx, meta: Meta, patch: Patch<LpPoolDaily>): Promise<void> {
  const id = String(meta.day);
  const row: LpPoolDaily = (await ctx.LpPoolDaily.get(id)) ?? {
    id,
    day: meta.day,
    deposits: 0n,
    redeems: 0n,
    sharesMinted: 0n,
    sharesBurned: 0n,
    traderFees: 0n,
    traderPnl: 0n,
  };
  ctx.LpPoolDaily.set({ ...row, ...patch(row) });
}
