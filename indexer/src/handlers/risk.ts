/** SenryoCore TriggerOrders, LiquidationModule and AdminModule (pause / settle-only). */
import { indexer, type OracleStatusEvent } from "envio";
import { updateCardDebt } from "../lib/card.ts";
import { ourMarketId } from "../lib/markets.ts";
import { EVENT_FIELDS, type Meta, metaOf, small } from "../lib/meta.ts";
import { updateProtocol, updateProtocolDaily } from "../lib/stats.ts";
import { addActivity, updateUser } from "../lib/users.ts";

indexer.onEvent(
  { contract: "SenryoCore", event: "TriggerPlaced", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    await updateUser(context, meta, p.user, () => ({}));
    context.Trigger.set({
      id: p.orderId,
      user_id: p.user,
      market_id: ourMarketId(small(p.marketId)),
      takeProfit: p.takeProfit,
      triggerPrice: p.triggerPrice18,
      size: p.sizeDelta,
      expiry: small(p.expiry),
      status: "PLACED",
      placedAt: meta.timestamp,
      closedAt: undefined,
      keeper: undefined,
      executedSize: undefined,
      txHash: meta.txHash,
    });
    addActivity(context, meta, p.user, "TRIGGER_PLACED", { trigger_id: p.orderId });
  },
);

indexer.onEvent(
  { contract: "SenryoCore", event: "TriggerCancelled", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, orderId } = event.params;
    const trigger = await context.Trigger.get(orderId);
    if (trigger) context.Trigger.set({ ...trigger, status: "CANCELLED", closedAt: meta.timestamp });
    addActivity(context, meta, user, "TRIGGER_CANCELLED", { trigger_id: orderId });
  },
);

indexer.onEvent(
  { contract: "SenryoCore", event: "TriggerExecuted", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, orderId, keeper, sizeDelta } = event.params;
    const trigger = await context.Trigger.get(orderId);
    if (trigger) {
      context.Trigger.set({
        ...trigger,
        status: "EXECUTED",
        closedAt: meta.timestamp,
        keeper,
        executedSize: sizeDelta,
      });
    }
    addActivity(context, meta, user, "TRIGGER_EXECUTED", { trigger_id: orderId });
  },
);

/** Emitted after the PositionUpdated(LIQUIDATE) rows of the same tx, which created the Liquidation row. */
indexer.onEvent({ contract: "SenryoCore", event: "Liquidated", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { user, liquidator, penalty, liquidatorFee, shortfall } = event.params;
  const id = `${meta.txHash}-${user}`;
  const row = await context.Liquidation.get(id);
  context.Liquidation.set({
    id,
    user_id: user,
    venue: "OURS",
    market_id: row?.market_id,
    liquidator,
    penalty,
    liquidatorFee,
    shortfall,
    insuranceCovered: row?.insuranceCovered ?? 0n,
    socialized: row?.socialized ?? 0n,
    realizedPnl: row?.realizedPnl ?? 0n,
    positionsClosed: row?.positionsClosed ?? 0,
    markPrice: undefined,
    liqPrice: undefined,
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
  });
  addActivity(context, meta, user, "LIQUIDATION", { amount: -penalty, liquidation_id: id });
  await updateProtocol(context, meta, (s) => ({ liquidations: s.liquidations + 1 }));
  await updateProtocolDaily(context, meta, (d) => ({ liquidations: d.liquidations + 1 }));
});

/** Inside liquidate() (shortfall cover, before Liquidated) or coverCardDebt() (card debt, no positions). */
indexer.onEvent(
  { contract: "SenryoCore", event: "InsuranceCovered", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const { user, covered, socialized } = event.params;
    const id = `${meta.txHash}-${user}`;
    const liquidation = await context.Liquidation.get(id);
    if (liquidation) {
      context.Liquidation.set({
        ...liquidation,
        insuranceCovered: liquidation.insuranceCovered + covered,
        socialized: liquidation.socialized + socialized,
      });
    } else {
      await updateCardDebt(context, meta, user, (d) => ({
        coveredByInsurance: d.coveredByInsurance + covered,
        outstanding: d.outstanding - covered,
      }));
    }
    await updateProtocol(context, meta, (s) => ({
      insuranceCovered: s.insuranceCovered + covered,
      socialized: s.socialized + socialized,
    }));
  },
);

function protocolEvent(meta: Meta, fields: Pick<OracleStatusEvent, "kind" | "until" | "detail">): OracleStatusEvent {
  return {
    id: meta.id,
    market_id: undefined,
    previous: undefined,
    current: undefined,
    price: undefined,
    roundId: undefined,
    rejectedPrice: undefined,
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
    ...fields,
  };
}

indexer.onEvent({ contract: "SenryoCore", event: "PausedUntil", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const until = small(event.params.until);
  context.OracleStatusEvent.set(protocolEvent(meta, { kind: "PROTOCOL_PAUSED", until, detail: undefined }));
  await updateProtocol(context, meta, () => ({ pausedUntil: until === 0 ? undefined : until }));
});

indexer.onEvent(
  { contract: "SenryoCore", event: "SettleOnlySet", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const on = event.params.settleOnly;
    context.OracleStatusEvent.set(
      protocolEvent(meta, { kind: "SETTLE_ONLY", until: undefined, detail: on ? "on" : "off" }),
    );
    await updateProtocol(context, meta, () => ({ settleOnly: on }));
  },
);
