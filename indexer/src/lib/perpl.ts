/** Perpl position lifecycle for app users (Position/Fill rows shared with our venue) and the fill cursor. */
import type { Fill, Market, PerplAccount, Position } from "envio";
import { PERPL_CURSOR_ID, SIZE_PRICE_TO_USD6 } from "./constants.ts";
import { APP_LAUNCH_BLOCK } from "./env.ts";
import { perplMarketId, recordLateFee, recordTradeStats } from "./markets.ts";
import type { Ctx, Meta } from "./meta.ts";
import { updateMarketDaily, updateProtocol, updateProtocolDaily, updateUserDaily } from "./stats.ts";
import { addActivity, updateUser } from "./users.ts";

/** Noisy Perpl events start at APP_LAUNCH_BLOCK (metadata and accounts start at Perpl's deploy block). */
export const afterLaunch = ({ chain }: { chain: { id: number } }) => ({
  block: { number: { _gte: APP_LAUNCH_BLOCK[chain.id] ?? 0 } },
});

export interface PerplScope {
  accountKey: string;
  marketId: string;
  pointerId: string;
  account: PerplAccount | undefined;
  market: Market | undefined;
  /** Set only for app users (a User owns the Perpl account) whose market metadata is known. */
  userId: string | undefined;
}

export async function perplScope(ctx: Ctx, perpId: bigint, accountId: bigint): Promise<PerplScope> {
  const accountKey = accountId.toString();
  const marketId = perplMarketId(perpId);
  const [account, market] = await Promise.all([ctx.PerplAccount.get(accountKey), ctx.Market.get(marketId)]);
  return {
    accountKey,
    marketId,
    pointerId: `${marketId}-${accountKey}`,
    account,
    market,
    userId: market ? account?.user_id : undefined,
  };
}

/** Every Position* event (any account) overwrites the cursor; fills consume it. */
export function moveCursor(ctx: Ctx, meta: Meta, scope: PerplScope): void {
  ctx.PerplCursor.set({
    id: PERPL_CURSOR_ID,
    txHash: meta.txHash,
    logIndex: meta.logIndex,
    accountId: scope.accountKey,
    marketId: scope.marketId,
    fillId: scope.userId ? meta.id : undefined,
  });
}

export async function currentPerplPosition(ctx: Ctx, pointerId: string): Promise<Position | undefined> {
  const pointer = await ctx.PositionPointer.get(pointerId);
  const position = pointer ? await ctx.Position.get(pointer.positionId) : undefined;
  return position?.status === "OPEN" ? position : undefined;
}

export interface PerplTrade {
  kind: Fill["kind"];
  side: Position["side"];
  /** 1e18 traded size */
  delta: bigint;
  /** 1e18; undefined until the paired fill event supplies it (decreases) */
  price: bigint | undefined;
  nextSize: bigint;
  nextEntry: bigint;
  /** usd6 posted margin after the event */
  margin: bigint;
  fee: bigint;
  realizedPnl: bigint;
  funding: bigint;
  /** start a new lifecycle row even if one is open (OPEN, second leg of INVERT) */
  fresh: boolean;
  closedAs?: "CLOSED" | "LIQUIDATED";
  /** PnL/funding booked on the position row when it differs from the fill's (an inversion books them on the old leg) */
  positionPnl?: bigint;
  positionFunding?: bigint;
}

/** Writes Position + Fill (id = the event id) + activity + aggregates for one app-user Position* event. */
export async function applyPerplTrade(ctx: Ctx, meta: Meta, scope: PerplScope, t: PerplTrade): Promise<void> {
  const userId = scope.userId;
  const market = scope.market;
  if (!userId || !market) return;
  const current = t.fresh ? undefined : await currentPerplPosition(ctx, scope.pointerId);
  const closed = t.nextSize === 0n;
  const positionId = current?.id ?? `${scope.pointerId}-${meta.id}`;
  ctx.Position.set({
    id: positionId,
    user_id: userId,
    market_id: market.id,
    venue: "PERPL",
    side: t.side,
    status: closed ? (t.closedAs ?? "CLOSED") : "OPEN",
    size: t.nextSize,
    entryPrice: t.nextEntry,
    margin: t.margin,
    realizedPnl: (current?.realizedPnl ?? 0n) + (t.positionPnl ?? t.realizedPnl),
    feesPaid: (current?.feesPaid ?? 0n) + t.fee,
    fundingPaid: (current?.fundingPaid ?? 0n) + (t.positionFunding ?? t.funding),
    borrowPaid: 0n,
    openedAt: current?.openedAt ?? meta.timestamp,
    openedBlock: current?.openedBlock ?? meta.block,
    updatedAt: meta.timestamp,
    closedAt: closed ? meta.timestamp : undefined,
    perplAccount_id: scope.accountKey,
  });
  if (closed) ctx.PositionPointer.deleteUnsafe(scope.pointerId);
  else ctx.PositionPointer.set({ id: scope.pointerId, positionId });

  const notional = t.price === undefined ? 0n : (t.delta * t.price) / SIZE_PRICE_TO_USD6;
  ctx.Fill.set({
    id: meta.id,
    user_id: userId,
    market_id: market.id,
    position_id: positionId,
    venue: "PERPL",
    kind: t.kind,
    side: t.side,
    size: t.delta,
    price: t.price,
    oraclePrice: undefined,
    notional,
    fee: t.fee,
    realizedPnl: t.realizedPnl,
    funding: t.funding,
    borrow: 0n,
    isMaker: undefined,
    builderId: undefined,
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
  });
  addActivity(ctx, meta, userId, "TRADE", {
    amount: notional,
    symbol: market.symbol,
    market_id: market.id,
    fill_id: meta.id,
  });
  ctx.Market.set({ ...market, appVolume: market.appVolume + notional, appTradeCount: market.appTradeCount + 1 });
  await recordTradeStats(ctx, meta, {
    userId,
    marketId: market.id,
    venue: "PERPL",
    notional,
    fee: t.fee,
    realizedPnl: t.realizedPnl,
    funding: t.funding,
    borrow: 0n,
    openDelta: current ? (closed ? -1 : 0) : closed ? 0 : 1,
    liquidation: t.closedAs === "LIQUIDATED",
  });
}

export interface FillCompletion {
  price: bigint;
  fee: bigint;
  isMaker: boolean;
  builderId: bigint;
}

/** A paired Maker/TakerOrderFilledV2 completes the app user's fill: fee, maker/taker, and the price if missing. */
export async function completeFill(ctx: Ctx, meta: Meta, fillId: string, c: FillCompletion): Promise<void> {
  const fill = await ctx.Fill.get(fillId);
  if (!fill) return;
  const late = fill.price === undefined ? (fill.size * c.price) / SIZE_PRICE_TO_USD6 : 0n;
  ctx.Fill.set({
    ...fill,
    price: fill.price ?? c.price,
    notional: fill.notional + late,
    fee: fill.fee + c.fee,
    isMaker: c.isMaker,
    builderId: c.builderId,
  });
  await recordLateFee(ctx, meta, fill.user_id, fill.market_id, c.fee);
  if (late === 0n) return;
  await updateUser(ctx, meta, fill.user_id, (u) => ({ volume: u.volume + late }));
  await updateUserDaily(ctx, meta, fill.user_id, (d) => ({ volume: d.volume + late }));
  await updateMarketDaily(ctx, meta, fill.market_id, (d) => ({ appVolume: d.appVolume + late }));
  const market = await ctx.Market.get(fill.market_id);
  if (market) ctx.Market.set({ ...market, appVolume: market.appVolume + late });
  await updateProtocol(ctx, meta, (s) => ({ volumePerplApp: s.volumePerplApp + late }));
  await updateProtocolDaily(ctx, meta, (d) => ({ volume: d.volume + late }));
}
