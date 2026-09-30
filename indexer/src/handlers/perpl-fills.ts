/**
 * Perpl Maker/TakerOrderFilledV2 → the PerplCursor pairing (specs/services.md): a fill consumes the cursor only if it
 * is in the same tx, after the Position* event, and (maker) for the same account; the cursor is cleared after use.
 * Anything else counts in ProtocolStats.unattributedFills — the alarm for an undocumented ordering change.
 * Taker fills also feed Perpl-wide market volume (third-party aggregate) and our builder volume.
 */
import { indexer } from "envio";
import { PERPL_CURSOR_ID } from "../lib/constants.ts";
import { PERPL_BUILDER_ID } from "../lib/env.ts";
import { type Ctx, EVENT_FIELDS, type Meta, metaOf } from "../lib/meta.ts";
import { afterLaunch, completeFill } from "../lib/perpl.ts";
import { type CursorState, type FillLog, pairFill, perplNotional, toWad } from "../lib/perpl-math.ts";
import { updateMarketDaily, updateProtocol } from "../lib/stats.ts";
import { updateUser } from "../lib/users.ts";

/** Pairs the fill with the cursor; on success clears it, on mismatch raises the alarm. */
async function consumeCursor(ctx: Ctx, meta: Meta, fill: FillLog): Promise<CursorState | undefined> {
  const row = await ctx.PerplCursor.get(PERPL_CURSOR_ID);
  const pairing = pairFill(row, fill);
  if (!pairing.ok) {
    ctx.log.warn(`unattributed Perpl fill (${pairing.reason})`, { txHash: meta.txHash, logIndex: meta.logIndex });
    await updateProtocol(ctx, meta, (s) => ({ unattributedFills: s.unattributedFills + 1 }));
    return undefined;
  }
  ctx.PerplCursor.deleteUnsafe(PERPL_CURSOR_ID);
  await updateProtocol(ctx, meta, (s) => ({ perplFillsAttributed: s.perplFillsAttributed + 1 }));
  return pairing.cursor;
}

async function settleAccountBalance(ctx: Ctx, meta: Meta, accountId: string, balance: bigint): Promise<void> {
  const account = await ctx.PerplAccount.get(accountId);
  if (!account?.user_id) return;
  ctx.PerplAccount.set({ ...account, balance });
  await updateUser(ctx, meta, account.user_id, () => ({ perplCollateral: balance }));
}

indexer.onEvent(
  { contract: "PerplExchange", event: "MakerOrderFilledV2", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const cursor = await consumeCursor(context, meta, {
      txHash: meta.txHash,
      logIndex: meta.logIndex,
      accountId: p.accountId.toString(),
    });
    if (!cursor?.fillId) return;
    const market = await context.Market.get(cursor.marketId);
    if (!market) return;
    await completeFill(context, meta, cursor.fillId, {
      price: toWad(p.pricePNS, market.priceDecimals),
      fee: p.feeCNS + p.builderFeeCNS,
      isMaker: true,
      builderId: p.builderId,
    });
    await settleAccountBalance(context, meta, cursor.accountId, p.balanceCNS);
  },
);

indexer.onEvent(
  { contract: "PerplExchange", event: "TakerOrderFilledV2", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const cursor = await consumeCursor(context, meta, { txHash: meta.txHash, logIndex: meta.logIndex });
    if (!cursor) return;
    const market = await context.Market.get(cursor.marketId);
    if (!market) return;
    const notional = perplNotional(p.entryPricePNS, p.lotLNS, market.priceDecimals, market.lotDecimals);
    const price = toWad(p.entryPricePNS, market.priceDecimals);
    context.Market.set({
      ...market,
      volume: market.volume + notional,
      tradeCount: market.tradeCount + 1,
      lastPrice: price,
      lastPriceAt: meta.timestamp,
    });
    await updateMarketDaily(context, meta, market.id, (d) => ({ volume: d.volume + notional, trades: d.trades + 1 }));
    const ours = PERPL_BUILDER_ID !== 0n && p.builderId === PERPL_BUILDER_ID;
    await updateProtocol(context, meta, (s) => ({
      perplVolumeAll: s.perplVolumeAll + notional,
      builderVolume: s.builderVolume + (ours ? notional : 0n),
    }));
    if (!cursor.fillId) return;
    await completeFill(context, meta, cursor.fillId, {
      price,
      fee: p.feeCNS + p.builderFeeCNS,
      isMaker: false,
      builderId: p.builderId,
    });
    await settleAccountBalance(context, meta, cursor.accountId, p.balanceCNS);
  },
);
