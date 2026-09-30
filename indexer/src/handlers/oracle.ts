/** SessionOracle: market session status (OPEN/CLOSED/STALE/CIRCUIT/HALTED), accepted prices, rejections, feeds. */
import { indexer, type OracleStatusEvent } from "envio";
import { MARKET_STATUSES } from "../lib/constants.ts";
import { loadOurMarket } from "../lib/markets.ts";
import { EVENT_FIELDS, enumAt, type Meta, metaOf, small } from "../lib/meta.ts";

type EventFields = Omit<OracleStatusEvent, "id" | "timestamp" | "block" | "txHash">;

function statusEvent(meta: Meta, fields: Partial<EventFields> & Pick<EventFields, "kind" | "market_id">) {
  return {
    id: meta.id,
    previous: undefined,
    current: undefined,
    price: undefined,
    roundId: undefined,
    rejectedPrice: undefined,
    until: undefined,
    detail: undefined,
    timestamp: meta.timestamp,
    block: meta.block,
    txHash: meta.txHash,
    ...fields,
  };
}

indexer.onEvent({ contract: "SessionOracle", event: "FeedSet", fields: EVENT_FIELDS }, async ({ event, context }) => {
  const meta = metaOf(event);
  const { marketId, feed, calendarId, clampBps, reopenClampBps } = event.params;
  const market = await loadOurMarket(context, small(marketId));
  context.Market.set(market);
  context.OracleStatusEvent.set(
    statusEvent(meta, {
      kind: "FEED_SET",
      market_id: market.id,
      detail: `feed=${feed} calendar=${calendarId} clampBps=${clampBps} reopenClampBps=${reopenClampBps}`,
    }),
  );
});

indexer.onEvent(
  { contract: "SessionOracle", event: "MarketStatusChanged", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const previous = enumAt(MARKET_STATUSES, p.previous, "MarketStatus");
    const current = enumAt(MARKET_STATUSES, p.current, "MarketStatus");
    const market = await loadOurMarket(context, small(p.marketId));
    context.Market.set({ ...market, status: current, statusSince: meta.timestamp });
    context.OracleStatusEvent.set(
      statusEvent(meta, { kind: "STATUS_CHANGED", market_id: market.id, previous, current, price: p.price18 }),
    );
  },
);

/** Every accepted round the engine will trade on (the chart's reference price is the raw round; see feeds.ts). */
indexer.onEvent(
  { contract: "SessionOracle", event: "PriceAccepted", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const p = event.params;
    const market = await loadOurMarket(context, small(p.marketId));
    context.Market.set({ ...market, lastPrice: p.price18, lastPriceAt: small(p.updatedAt) });
  },
);

indexer.onEvent(
  { contract: "SessionOracle", event: "PriceRejected", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const p = event.params;
    const market = await loadOurMarket(context, small(p.marketId));
    context.Market.set(market);
    context.OracleStatusEvent.set(
      statusEvent(meta, {
        kind: "PRICE_REJECTED",
        market_id: market.id,
        roundId: p.roundId,
        rejectedPrice: p.answer18,
        price: p.lastAccepted18,
      }),
    );
  },
);

indexer.onEvent(
  { contract: "SessionOracle", event: "MarketHalted", fields: EVENT_FIELDS },
  async ({ event, context }) => {
    const meta = metaOf(event);
    const until = small(event.params.until);
    const market = await loadOurMarket(context, small(event.params.marketId));
    context.Market.set(market);
    context.OracleStatusEvent.set(
      statusEvent(meta, { kind: until === 0 ? "UNHALTED" : "HALTED", market_id: market.id, until }),
    );
  },
);
