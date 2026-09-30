/**
 * Perpl Position* events (mainnet, from APP_LAUNCH_BLOCK). Every event moves the fill cursor; only accounts owned by
 * an app user get Position/Fill rows. Perpl units are normalised: prices/lots → 1e18 by the market's decimals, CNS = usd6.
 */
import { indexer } from "envio";
import { PERPL_POSITION_TYPES } from "../lib/constants.ts";
import { EVENT_FIELDS, enumAt, metaOf } from "../lib/meta.ts";
import { afterLaunch, applyPerplTrade, currentPerplPosition, moveCursor, perplScope } from "../lib/perpl.ts";
import { toWad, weightedEntry } from "../lib/perpl-math.ts";
import { updateProtocol, updateProtocolDaily } from "../lib/stats.ts";
import { addActivity, updateUser } from "../lib/users.ts";

const sideOf = (positionType: bigint) => enumAt(PERPL_POSITION_TYPES, positionType, "Perpl positionType");

indexer.onEvent(
  { contract: "PerplExchange", event: "PositionOpenedV2", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const scope = await perplScope(context, p.perpId, p.accountId);
    moveCursor(context, meta, scope);
    if (!scope.userId || !scope.market) return;
    const { priceDecimals, lotDecimals } = scope.market;
    const size = toWad(p.lotLNS, lotDecimals);
    const price = toWad(p.pricePNS, priceDecimals);
    await applyPerplTrade(context, meta, scope, {
      kind: "OPEN",
      side: sideOf(p.positionType),
      delta: size,
      price,
      nextSize: size,
      nextEntry: price,
      margin: p.depositCNS,
      fee: p.insFeeCNS + p.protFeeCNS,
      realizedPnl: 0n,
      funding: 0n,
      fresh: true,
    });
  },
);

indexer.onEvent(
  { contract: "PerplExchange", event: "PositionIncreasedV2", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const scope = await perplScope(context, p.perpId, p.accountId);
    moveCursor(context, meta, scope);
    if (!scope.userId || !scope.market) return;
    const { priceDecimals, lotDecimals } = scope.market;
    const current = await currentPerplPosition(context, scope.pointerId);
    const delta = toWad(p.endLotLNS - p.startLotLNS, lotDecimals);
    const price = toWad(p.pricePNS, priceDecimals);
    await applyPerplTrade(context, meta, scope, {
      kind: "INCREASE",
      side: sideOf(p.positionType),
      delta,
      price,
      nextSize: toWad(p.endLotLNS, lotDecimals),
      nextEntry: current ? weightedEntry(current.entryPrice, current.size, price, delta) : price,
      margin: p.endDepositCNS,
      fee: p.insFeeCNS + p.protFeeCNS,
      realizedPnl: 0n,
      funding: 0n,
      fresh: false,
    });
  },
);

/** No price in the event: the paired maker/taker fill supplies it (completeFill). */
indexer.onEvent(
  { contract: "PerplExchange", event: "PositionDecreased", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const scope = await perplScope(context, p.perpId, p.accountId);
    moveCursor(context, meta, scope);
    if (!scope.userId || !scope.market) return;
    const { lotDecimals } = scope.market;
    const current = await currentPerplPosition(context, scope.pointerId);
    await applyPerplTrade(context, meta, scope, {
      kind: p.endLotLNS === 0n ? "CLOSE" : "DECREASE",
      side: sideOf(p.positionType),
      delta: toWad(p.startLotLNS - p.endLotLNS, lotDecimals),
      price: undefined,
      nextSize: toWad(p.endLotLNS, lotDecimals),
      nextEntry: current?.entryPrice ?? 0n,
      margin: p.endDepositCNS,
      fee: 0n,
      realizedPnl: p.deltaPnlCNS,
      funding: p.fundingCNS,
      fresh: false,
    });
  },
);

indexer.onEvent(
  { contract: "PerplExchange", event: "PositionClosed", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const scope = await perplScope(context, p.perpId, p.accountId);
    moveCursor(context, meta, scope);
    if (!scope.userId || !scope.market) return;
    const price = toWad(p.pricePNS, scope.market.priceDecimals);
    const current = await currentPerplPosition(context, scope.pointerId);
    await applyPerplTrade(context, meta, scope, {
      kind: "CLOSE",
      side: sideOf(p.positionType),
      delta: current?.size ?? 0n,
      price,
      nextSize: 0n,
      nextEntry: current?.entryPrice ?? price,
      margin: 0n,
      fee: 0n,
      realizedPnl: p.deltaPnlCNS,
      funding: p.fundingCNS,
      fresh: false,
    });
  },
);

/** A flip: the old leg closes (PnL, funding), a new leg opens on the other side with endLot. */
indexer.onEvent(
  { contract: "PerplExchange", event: "PositionInverted", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const scope = await perplScope(context, p.perpId, p.accountId);
    moveCursor(context, meta, scope);
    const userId = scope.userId;
    if (!userId || !scope.market) return;
    const { priceDecimals, lotDecimals } = scope.market;
    const price = toWad(p.pricePNS, priceDecimals);
    const old = await currentPerplPosition(context, scope.pointerId);
    if (old) {
      context.Position.set({
        ...old,
        status: "CLOSED",
        size: 0n,
        realizedPnl: old.realizedPnl + p.deltaPnlCNS,
        fundingPaid: old.fundingPaid + p.fundingCNS,
        updatedAt: meta.timestamp,
        closedAt: meta.timestamp,
      });
      await updateUser(context, meta, userId, (u) => ({ openPositions: Math.max(0, u.openPositions - 1) }));
    }
    const size = toWad(p.endLotLNS, lotDecimals);
    await applyPerplTrade(context, meta, scope, {
      kind: "INVERT",
      side: sideOf(p.positionType),
      delta: toWad(p.startLotLNS + p.endLotLNS, lotDecimals),
      price,
      nextSize: size,
      nextEntry: price,
      margin: p.endDepositCNS,
      fee: p.insFeeCNS + p.protFeeCNS,
      realizedPnl: p.deltaPnlCNS,
      funding: p.fundingCNS,
      fresh: true,
      positionPnl: 0n,
      positionFunding: 0n,
    });
  },
);

/** F48: Perpl liquidations of app users. `posLotLNS − liqLotLNS` remains (partial liquidation; semantics observed). */
indexer.onEvent(
  { contract: "PerplExchange", event: "PositionLiquidated", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const scope = await perplScope(context, p.perpId, p.posAccountId);
    moveCursor(context, meta, scope);
    const userId = scope.userId;
    if (!userId || !scope.market || !scope.account) return;
    const { priceDecimals, lotDecimals } = scope.market;
    const current = await currentPerplPosition(context, scope.pointerId);
    const remaining = p.posLotLNS > p.liqLotLNS ? p.posLotLNS - p.liqLotLNS : 0n;
    const liqPrice = toWad(p.liqPricePNS, priceDecimals);
    await applyPerplTrade(context, meta, scope, {
      kind: "LIQUIDATE",
      side: sideOf(p.positionType),
      delta: toWad(p.liqLotLNS, lotDecimals),
      price: liqPrice,
      nextSize: toWad(remaining, lotDecimals),
      nextEntry: current?.entryPrice ?? liqPrice,
      margin: p.posDepositCNS,
      fee: 0n,
      realizedPnl: p.deltaPnlCNS,
      funding: p.fundingCNS,
      fresh: false,
      closedAs: "LIQUIDATED",
    });
    context.PerplAccount.set({ ...scope.account, balance: p.accBalanceCNS });
    context.Liquidation.set({
      id: meta.id,
      user_id: userId,
      venue: "PERPL",
      market_id: scope.marketId,
      liquidator: undefined,
      penalty: 0n,
      liquidatorFee: 0n,
      shortfall: 0n,
      insuranceCovered: 0n,
      socialized: 0n,
      realizedPnl: p.deltaPnlCNS,
      positionsClosed: remaining === 0n ? 1 : 0,
      markPrice: toWad(p.markPricePNS, priceDecimals),
      liqPrice,
      timestamp: meta.timestamp,
      block: meta.block,
      txHash: meta.txHash,
    });
    addActivity(context, meta, userId, "LIQUIDATION", { liquidation_id: meta.id, market_id: scope.marketId }, "liq");
    await updateUser(context, meta, userId, () => ({ perplCollateral: p.accBalanceCNS }));
    await updateProtocol(context, meta, (s) => ({ liquidations: s.liquidations + 1 }));
    await updateProtocolDaily(context, meta, (d) => ({ liquidations: d.liquidations + 1 }));
  },
);

indexer.onEvent(
  { contract: "PerplExchange", event: "PositionDeleveragedV2", where: afterLaunch, fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const scope = await perplScope(context, p.perpId, p.accountId);
    moveCursor(context, meta, scope);
    if (!scope.userId || !scope.market) return;
    const { priceDecimals, lotDecimals } = scope.market;
    const current = await currentPerplPosition(context, scope.pointerId);
    await applyPerplTrade(context, meta, scope, {
      kind: "DELEVERAGE",
      side: sideOf(p.positionType),
      delta: toWad(p.startLotLNS - p.endLotLNS, lotDecimals),
      price: toWad(p.deleveragePricePNS, priceDecimals),
      nextSize: toWad(p.endLotLNS, lotDecimals),
      nextEntry: current?.entryPrice ?? toWad(p.entryPricePNS, priceDecimals),
      margin: p.endDepositCNS,
      fee: 0n,
      realizedPnl: p.deltaPnlCNS,
      funding: p.fundingCNS,
      fresh: false,
    });
  },
);
