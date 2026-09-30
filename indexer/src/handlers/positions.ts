/** SenryoCore PerpModule / MarketAccounting: our gold and silver positions, fills, funding and market state. */
import { type Fill, indexer, type Position } from "envio";
import { recordTick } from "../lib/candles.ts";
import { POSITION_KINDS, SIZE_PRICE_TO_USD6 } from "../lib/constants.ts";
import { loadOurMarket, recordTradeStats } from "../lib/markets.ts";
import { type Ctx, EVENT_FIELDS, enumAt, type Meta, metaOf, small } from "../lib/meta.ts";
import { updateLpDaily, updateMarketDaily } from "../lib/stats.ts";
import { addActivity } from "../lib/users.ts";

/** Current lifecycle row for (market, user); a new OPEN (or none) starts a new row. */
async function currentPosition(ctx: Ctx, pointerId: string): Promise<Position | undefined> {
  const pointer = await ctx.PositionPointer.get(pointerId);
  if (!pointer) return undefined;
  const position = await ctx.Position.get(pointer.positionId);
  return position?.status === "OPEN" ? position : undefined;
}

/** A liquidation closes every position of the user in one tx: one Liquidation row per (tx, user). */
async function addToLiquidation(ctx: Ctx, meta: Meta, user: string, marketId: string, realizedPnl: bigint) {
  const id = `${meta.txHash}-${user}`;
  const row = await ctx.Liquidation.get(id);
  ctx.Liquidation.set({
    id,
    user_id: user,
    venue: "OURS",
    market_id: row ? row.market_id : marketId,
    liquidator: row?.liquidator,
    penalty: row?.penalty ?? 0n,
    liquidatorFee: row?.liquidatorFee ?? 0n,
    shortfall: row?.shortfall ?? 0n,
    insuranceCovered: row?.insuranceCovered ?? 0n,
    socialized: row?.socialized ?? 0n,
    realizedPnl: (row?.realizedPnl ?? 0n) + realizedPnl,
    positionsClosed: (row?.positionsClosed ?? 0) + 1,
    markPrice: undefined,
    liqPrice: undefined,
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
  });
}

indexer.onEvent(
  { contract: "SenryoCore", event: "PositionUpdated", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const kind = enumAt(POSITION_KINDS, p.kind, "PositionKind");
    const market = await loadOurMarket(context, small(p.marketId));
    const pointerId = `${market.id}-${p.user}`;
    const current = kind === "OPEN" ? undefined : await currentPosition(context, pointerId);
    const side = p.isLong ? "LONG" : "SHORT";
    const closed = p.sizeAfter === 0n;
    const status: Position["status"] = !closed ? "OPEN" : kind === "LIQUIDATE" ? "LIQUIDATED" : "CLOSED";
    const positionId = current?.id ?? `${pointerId}-${meta.id}`;
    const notional = (p.sizeDelta * p.execPrice) / SIZE_PRICE_TO_USD6;

    context.Position.set({
      id: positionId,
      user_id: p.user,
      market_id: market.id,
      venue: "OURS",
      side,
      status,
      size: p.sizeAfter,
      entryPrice: closed ? (current?.entryPrice ?? p.entryAfter) : p.entryAfter,
      margin: 0n,
      realizedPnl: (current?.realizedPnl ?? 0n) + p.realizedPnl,
      feesPaid: (current?.feesPaid ?? 0n) + p.fee,
      fundingPaid: (current?.fundingPaid ?? 0n) + p.funding,
      borrowPaid: (current?.borrowPaid ?? 0n) + p.borrow,
      openedAt: current?.openedAt ?? meta.timestamp,
      openedBlock: current?.openedBlock ?? meta.block,
      updatedAt: meta.timestamp,
      closedAt: closed ? meta.timestamp : undefined,
      perplAccount_id: undefined,
    });
    if (closed) context.PositionPointer.deleteUnsafe(pointerId);
    else context.PositionPointer.set({ id: pointerId, positionId });

    const fill: Fill = {
      id: meta.id,
      user_id: p.user,
      market_id: market.id,
      position_id: positionId,
      venue: "OURS",
      kind,
      side,
      size: p.sizeDelta,
      price: p.execPrice,
      oraclePrice: p.oraclePrice,
      notional,
      fee: p.fee,
      realizedPnl: p.realizedPnl,
      funding: p.funding,
      borrow: p.borrow,
      isMaker: undefined,
      builderId: undefined,
      timestamp: meta.timestamp,
      block: meta.block,
      txHash: meta.txHash,
    };
    context.Fill.set(fill);
    if (p.funding !== 0n || p.borrow !== 0n) {
      context.FundingAccrual.set({
        id: meta.id,
        user_id: p.user,
        market_id: market.id,
        position_id: positionId,
        funding: p.funding,
        borrow: p.borrow,
        timestamp: meta.timestamp,
        block: meta.block,
      });
    }
    const liquidation = kind === "LIQUIDATE";
    if (liquidation) await addToLiquidation(context, meta, p.user, market.id, p.realizedPnl);
    addActivity(context, meta, p.user, "TRADE", {
      amount: notional,
      symbol: market.symbol,
      market_id: market.id,
      fill_id: meta.id,
    });

    // MarketStateUpdated is emitted at accrual, before the size change: apply this fill's delta on top of it.
    const adds = kind === "OPEN" || kind === "INCREASE";
    const sized = (side: bigint) => (adds ? side + p.sizeDelta : side > p.sizeDelta ? side - p.sizeDelta : 0n);
    const longSize = p.isLong ? sized(market.longSize) : market.longSize;
    const shortSize = p.isLong ? market.shortSize : sized(market.shortSize);
    context.Market.set({
      ...market,
      longSize,
      shortSize,
      volume: market.volume + notional,
      tradeCount: market.tradeCount + 1,
      appVolume: market.appVolume + notional,
      appTradeCount: market.appTradeCount + 1,
    });
    await updateMarketDaily(context, meta, market.id, (d) => ({
      volume: d.volume + notional,
      trades: d.trades + 1,
      longSize,
      shortSize,
    }));
    await recordTradeStats(context, meta, {
      userId: p.user,
      marketId: market.id,
      venue: "OURS",
      notional,
      fee: p.fee,
      realizedPnl: p.realizedPnl,
      funding: p.funding,
      borrow: p.borrow,
      openDelta: current ? (closed ? -1 : 0) : closed ? 0 : 1,
      liquidation,
    });
    await updateLpDaily(context, meta, (d) => ({
      traderFees: d.traderFees + p.fee,
      traderPnl: d.traderPnl + p.realizedPnl,
    }));
    if (market.feed_id) {
      await recordTick(context, {
        feed: market.feed_id,
        price: p.execPrice,
        timestamp: meta.timestamp,
        source: "fill",
        volume: notional,
      });
    }
  },
);

/** Accrual snapshot (pre-trade sizes, funding/borrow indices and rates); the fill that follows applies its delta. */
indexer.onEvent(
  { contract: "SenryoCore", event: "MarketStateUpdated", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const market = await loadOurMarket(context, small(p.marketId));
    context.Market.set({
      ...market,
      longSize: p.longSize,
      shortSize: p.shortSize,
      fundingIndex: p.fundingIndex,
      borrowIndex: p.borrowIndex,
      fundingRate: p.fundingRate,
      borrowRate: p.borrowRate,
    });
    context.FundingRate.set({
      id: meta.id,
      market_id: market.id,
      fundingRate: p.fundingRate,
      borrowRate: p.borrowRate,
      fundingIndex: p.fundingIndex,
      timestamp: meta.timestamp,
      block: meta.block,
    });
  },
);

indexer.onEvent({ contract: "SenryoCore", event: "MarketConfigured" }, async ({ event, context }) => {
  const market = await loadOurMarket(context, small(event.params.marketId));
  context.Market.set({ ...market, enabled: event.params.enabled });
});
