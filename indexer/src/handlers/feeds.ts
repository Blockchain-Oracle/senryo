/**
 * Oracle rounds → OracleRound + OracleFeed + candles (D-020). FeedXAU/FeedXAG are the configured aggregators
 * (mainnet OCR2 behind the Chainlink proxies, testnet MirrorAggregators); FeedXAUNext/FeedXAGNext are aggregators the
 * proxies switch to later, registered at runtime by the wildcard watcher below.
 */
import { indexer, type OracleFeed } from "envio";
import { recordTick } from "../lib/candles.ts";
import { FEED_DECIMALS, type FeedSymbol, TEN, WAD_DECIMALS } from "../lib/constants.ts";
import { aggregatorSymbol } from "../lib/feeds.ts";
import { type Ctx, EVENT_FIELDS, metaOf, small } from "../lib/meta.ts";
import { updateProtocol } from "../lib/stats.ts";

const FEED_TO_WAD = TEN ** BigInt(WAD_DECIMALS - FEED_DECIMALS);

interface RoundEvent {
  chainId: number;
  logIndex: number;
  srcAddress: string;
  params: { current: bigint; roundId: bigint; updatedAt: bigint };
  block: { number: number; timestamp: number };
  transaction: { hash: string };
}

async function recordRound(ctx: Ctx, event: RoundEvent, symbol: FeedSymbol): Promise<void> {
  const meta = metaOf(event);
  const { current: answer, roundId, updatedAt } = event.params;
  const aggregator = event.srcAddress.toLowerCase();
  const price = answer > 0n ? answer * FEED_TO_WAD : 0n;
  const at = small(updatedAt);
  ctx.OracleRound.set({
    id: `${aggregator}-${roundId}`,
    feed_id: symbol,
    aggregator,
    roundId,
    answer,
    price,
    updatedAt: at,
    block: meta.block,
    txHash: meta.txHash,
  });
  const feed: OracleFeed | undefined = await ctx.OracleFeed.get(symbol);
  if (feed && feed.aggregator !== aggregator) {
    ctx.OracleStatusEvent.set({
      id: meta.id,
      market_id: undefined,
      kind: "AGGREGATOR_ADDED",
      previous: undefined,
      current: undefined,
      price,
      roundId,
      rejectedPrice: undefined,
      until: undefined,
      detail: `${symbol} rounds now from ${aggregator} (was ${feed.aggregator})`,
      timestamp: meta.timestamp,
      block: meta.block,
      txHash: meta.txHash,
    });
  }
  ctx.OracleFeed.set({
    id: symbol,
    symbol,
    decimals: FEED_DECIMALS,
    aggregator,
    latestRoundId: roundId,
    latestAnswer: answer,
    latestPrice: price,
    latestUpdatedAt: at,
    roundCount: (feed?.roundCount ?? 0) + 1,
  });
  await recordTick(ctx, { feed: symbol, price, timestamp: at, source: "round", volume: 0n });
  await updateProtocol(ctx, meta, (s) => ({ oracleRounds: s.oracleRounds + 1 }));
}

indexer.onEvent({ contract: "FeedXAU", event: "AnswerUpdated", fields: EVENT_FIELDS }, ({ event, context }) =>
  recordRound(context, event, "XAU"),
);
indexer.onEvent({ contract: "FeedXAG", event: "AnswerUpdated", fields: EVENT_FIELDS }, ({ event, context }) =>
  recordRound(context, event, "XAG"),
);
indexer.onEvent({ contract: "FeedXAUNext", event: "AnswerUpdated", fields: EVENT_FIELDS }, ({ event, context }) =>
  recordRound(context, event, "XAU"),
);
indexer.onEvent({ contract: "FeedXAGNext", event: "AnswerUpdated", fields: EVENT_FIELDS }, ({ event, context }) =>
  recordRound(context, event, "XAG"),
);

/** Addresses already indexed under a Feed* name on this chain (static config or earlier registration). */
const registered = new Set<string>();

function isConfigured(chainId: 143 | 10143, address: string): boolean {
  const chain = indexer.chains[chainId];
  return [chain.FeedXAU, chain.FeedXAG].some((c) => c.addresses.some((a) => a.toLowerCase() === address));
}

/**
 * Wildcard watcher (mainnet only, from ENVIO_FEED_WATCH_START_BLOCK_143): an AnswerUpdated from an unknown address is
 * checked against the proxies' phase lists; a confirmed new aggregator is registered and its rounds flow into the same
 * feed (same-block events included). Everything else is ignored — this handler writes nothing.
 */
indexer.contractRegister(
  { contract: "ChainlinkAnswer", event: "AnswerUpdated", wildcard: true },
  async ({ event, context }) => {
    const address = event.srcAddress.toLowerCase();
    if (registered.has(address) || isConfigured(event.chainId, address)) return;
    const symbol = await aggregatorSymbol(event.chainId, address);
    if (!symbol) return;
    registered.add(address);
    if (symbol === "XAU") context.chain.FeedXAUNext.add(event.srcAddress);
    else context.chain.FeedXAGNext.add(event.srcAddress);
    context.log.info(`registered new ${symbol} aggregator ${address} (proxy phase list)`);
  },
);
