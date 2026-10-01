/**
 * Oracle rounds → OracleRound + OracleFeed + candles (D-020). Feed<SYMBOL> are the configured aggregators (mainnet
 * OCR2 behind the Chainlink proxies, testnet MirrorAggregators); Feed<SYMBOL>Next are aggregators the proxies switch
 * to later, registered at runtime by the wildcard watcher below. Metals answer in 8 decimals, FX (S8.23) in 18; every
 * price is stored at 1e18 in the feed's own orientation (JPY is USD per yen, never inverted). FeedW…X are the calculated
 * tokenized-equity feeds (mainnet only, read-only discovery charts, review S03): their feed id is the wrapper (wSPYx).
 */
import { indexer, type OracleFeed } from "envio";
import { recordTick } from "../lib/candles.ts";
import { FEED_DECIMALS_OF, type FeedSymbol, MAINNET_CHAIN_ID, TEN, WAD_DECIMALS } from "../lib/constants.ts";
import { aggregatorSymbol } from "../lib/feeds.ts";
import { type Ctx, EVENT_FIELDS, metaOf, small } from "../lib/meta.ts";
import { updateProtocol } from "../lib/stats.ts";

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
  const decimals = FEED_DECIMALS_OF[symbol];
  const price = answer > 0n ? answer * TEN ** BigInt(WAD_DECIMALS - decimals) : 0n;
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
    decimals,
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

const on = { event: "AnswerUpdated", fields: EVENT_FIELDS } as const;
indexer.onEvent({ contract: "FeedXAU", ...on }, ({ event, context }) => recordRound(context, event, "XAU"));
indexer.onEvent({ contract: "FeedXAG", ...on }, ({ event, context }) => recordRound(context, event, "XAG"));
indexer.onEvent({ contract: "FeedEUR", ...on }, ({ event, context }) => recordRound(context, event, "EUR"));
indexer.onEvent({ contract: "FeedGBP", ...on }, ({ event, context }) => recordRound(context, event, "GBP"));
indexer.onEvent({ contract: "FeedJPY", ...on }, ({ event, context }) => recordRound(context, event, "JPY"));
indexer.onEvent({ contract: "FeedCHF", ...on }, ({ event, context }) => recordRound(context, event, "CHF"));
indexer.onEvent({ contract: "FeedCAD", ...on }, ({ event, context }) => recordRound(context, event, "CAD"));
indexer.onEvent({ contract: "FeedWSPYX", ...on }, ({ event, context }) => recordRound(context, event, "wSPYx"));
indexer.onEvent({ contract: "FeedWQQQX", ...on }, ({ event, context }) => recordRound(context, event, "wQQQx"));
indexer.onEvent({ contract: "FeedWNVDAX", ...on }, ({ event, context }) => recordRound(context, event, "wNVDAx"));
indexer.onEvent({ contract: "FeedWTSLAX", ...on }, ({ event, context }) => recordRound(context, event, "wTSLAx"));
indexer.onEvent({ contract: "FeedWSPCXX", ...on }, ({ event, context }) => recordRound(context, event, "wSPCXx"));
indexer.onEvent({ contract: "FeedWEWYX", ...on }, ({ event, context }) => recordRound(context, event, "wEWYx"));
indexer.onEvent({ contract: "FeedXAUNext", ...on }, ({ event, context }) => recordRound(context, event, "XAU"));
indexer.onEvent({ contract: "FeedXAGNext", ...on }, ({ event, context }) => recordRound(context, event, "XAG"));
indexer.onEvent({ contract: "FeedEURNext", ...on }, ({ event, context }) => recordRound(context, event, "EUR"));
indexer.onEvent({ contract: "FeedGBPNext", ...on }, ({ event, context }) => recordRound(context, event, "GBP"));
indexer.onEvent({ contract: "FeedJPYNext", ...on }, ({ event, context }) => recordRound(context, event, "JPY"));
indexer.onEvent({ contract: "FeedCHFNext", ...on }, ({ event, context }) => recordRound(context, event, "CHF"));
indexer.onEvent({ contract: "FeedCADNext", ...on }, ({ event, context }) => recordRound(context, event, "CAD"));
indexer.onEvent({ contract: "FeedWSPYXNext", ...on }, ({ event, context }) => recordRound(context, event, "wSPYx"));
indexer.onEvent({ contract: "FeedWQQQXNext", ...on }, ({ event, context }) => recordRound(context, event, "wQQQx"));
indexer.onEvent({ contract: "FeedWNVDAXNext", ...on }, ({ event, context }) => recordRound(context, event, "wNVDAx"));
indexer.onEvent({ contract: "FeedWTSLAXNext", ...on }, ({ event, context }) => recordRound(context, event, "wTSLAx"));
indexer.onEvent({ contract: "FeedWSPCXXNext", ...on }, ({ event, context }) => recordRound(context, event, "wSPCXx"));
indexer.onEvent({ contract: "FeedWEWYXNext", ...on }, ({ event, context }) => recordRound(context, event, "wEWYx"));

/** Addresses already indexed under a Feed* name on this chain (static config or earlier registration). */
const registered = new Set<string>();

function isConfigured(address: string): boolean {
  const c = indexer.chains[MAINNET_CHAIN_ID];
  const statics = [c.FeedXAU, c.FeedXAG, c.FeedEUR, c.FeedGBP, c.FeedJPY, c.FeedCHF, c.FeedCAD];
  const equities = [c.FeedWSPYX, c.FeedWQQQX, c.FeedWNVDAX, c.FeedWTSLAX, c.FeedWSPCXX, c.FeedWEWYX];
  return [...statics, ...equities].some((feed) => feed.addresses.some((a) => a.toLowerCase() === address));
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
    if (event.chainId !== MAINNET_CHAIN_ID || registered.has(address) || isConfigured(address)) return;
    const symbol = await aggregatorSymbol(event.chainId, address);
    if (!symbol) return;
    registered.add(address);
    const next = {
      XAU: context.chain.FeedXAUNext,
      XAG: context.chain.FeedXAGNext,
      EUR: context.chain.FeedEURNext,
      GBP: context.chain.FeedGBPNext,
      JPY: context.chain.FeedJPYNext,
      CHF: context.chain.FeedCHFNext,
      CAD: context.chain.FeedCADNext,
      wSPYx: context.chain.FeedWSPYXNext,
      wQQQx: context.chain.FeedWQQQXNext,
      wNVDAx: context.chain.FeedWNVDAXNext,
      wTSLAx: context.chain.FeedWTSLAXNext,
      wSPCXx: context.chain.FeedWSPCXXNext,
      wEWYx: context.chain.FeedWEWYXNext,
    }[symbol];
    next.add(event.srcAddress);
    context.log.info(`registered new ${symbol} aggregator ${address} (proxy phase list)`);
  },
);
