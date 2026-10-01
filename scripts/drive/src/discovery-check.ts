/**
 * S1b discovery check (review S03). Read-only on Monad mainnet + Perpl's public API + the live indexer (no tx):
 *  1. every discovery instrument's quote: price, its time, 24 h change, open interest, 24 h volume, funding and its
 *     execution gate on each network (the smoke table)
 *  2. candle counts per chart interval and where they came from (Perpl trades, indexed rounds or onchain rounds)
 *  3. Perpl's onchain mark beside its REST ticker, read together (equal at one block; any gap is the blocks between)
 *   pnpm --filter @senryo/drive discovery-check            (INDEXER_GRAPHQL_URL overrides the live indexer)
 */
import { createReadClient, readPerplMarkets } from "@senryo/chain";
import {
  CALCULATED_EQUITIES,
  DISCOVERY_INSTRUMENTS,
  type DiscoveryInstrument,
  INDEXER_ORIGIN,
  MAINNET_CHAIN_ID,
  PERPL_API,
  PERPL_INSTRUMENTS,
  TESTNET_CHAIN_ID,
  UNPRICED_INSTRUMENTS,
} from "@senryo/config";
import { DECIMALS, formatUnits } from "@senryo/core";
import { CANDLE_INTERVALS, createIndexerClient, GRAPHQL_PATH } from "@senryo/indexer-client";
import {
  type DiscoveryCandles,
  type DiscoveryQuoteResult,
  fetchFeedCandles,
  fetchFeedQuotes,
  fetchPerplCandles,
  fetchPerplQuotes,
  type Metric,
} from "@senryo/query";
import { MS_PER_SECOND } from "./constants.ts";

const PRICE_DIGITS = 4;
const USD_DIGITS = 0;
const mainnet = createReadClient(MAINNET_CHAIN_ID);
const indexer = createIndexerClient({ url: process.env.INDEXER_GRAPHQL_URL ?? `${INDEXER_ORIGIN}${GRAPHQL_PATH}` });

const iso = (sec: number) => new Date(sec * MS_PER_SECOND).toISOString().replace(".000Z", "Z");
const shown = <T>(m: Metric<T>, f: (v: T) => string) => (m.available ? f(m.value) : `— (${m.reason})`);
const pct = (bps: bigint) => `${bps >= 0n ? "+" : ""}${formatUnits(bps, DECIMALS.bpsAsPct, DECIMALS.bpsAsPct)} %`;
const gate = (i: DiscoveryInstrument, chainId: typeof MAINNET_CHAIN_ID | typeof TESTNET_CHAIN_ID) => {
  const g = i.execution[chainId];
  return g.state === "blocked" ? `blocked ${g.blocker}` : "unavailable";
};

// ---------------------------------------------------------------- 1. quotes
const started = Date.now();
const results: DiscoveryQuoteResult[] = [
  ...(await fetchPerplQuotes(mainnet, PERPL_INSTRUMENTS)),
  ...(await fetchFeedQuotes(mainnet, CALCULATED_EQUITIES)),
];
console.log(`quotes read in ${Date.now() - started} ms`);
console.table(
  results.map((r) => {
    if ("error" in r) return { id: r.id, error: `${r.error.kind}: ${r.error.technical ?? ""}` };
    const q = r.quote;
    return {
      id: r.id,
      shown: q.instrument.class === "equity-calculated" ? q.instrument.displayName : q.instrument.name,
      [`price (${q.priceKind})`]: `$${formatUnits(q.price18, DECIMALS.e18, Math.max(q.priceDecimals, PRICE_DIGITS))}`,
      updatedAt: iso(q.updatedAt),
      activity: q.activity.state,
      "24h": shown(q.change24h, (c) => `${pct(c.bps)} from ${c.fromAt ? iso(c.fromAt) : "24 h ago"}`),
      OI: shown(q.openInterest, (o) => `$${formatUnits(o.usd6, DECIMALS.usd6, USD_DIGITS)}`),
      vol24h: shown(q.volume24hUsd6, (v) => `$${formatUnits(v, DECIMALS.usd6, USD_DIGITS)}`),
      funding: shown(q.funding, (f) =>
        f.intervalSec.available ? `${f.ratePct100k}e-5 / ${f.intervalSec.value} s` : `${f.ratePct100k}e-5`,
      ),
      mainnet: gate(q.instrument, MAINNET_CHAIN_ID),
      practice: gate(q.instrument, TESTNET_CHAIN_ID),
    };
  }),
);
for (const u of UNPRICED_INSTRUMENTS) console.log(`${u.id}: no data — ${u.data.reason}`);

// ---------------------------------------------------------------- 2. candles per interval
const describe = (c: DiscoveryCandles) =>
  c.kind === "none"
    ? `0 (${c.reason})`
    : `${c.candles.length}${c.coverage.complete ? "" : "*"} from ${iso(c.coverage.from)}`;
const rows: Record<string, string>[] = [];
const sourceOf = new Map<string, string>();
for (const instrument of DISCOVERY_INSTRUMENTS) {
  const row: Record<string, string> = { id: instrument.id };
  for (const interval of CANDLE_INTERVALS) {
    try {
      const candles =
        instrument.class === "crypto"
          ? await fetchPerplCandles(mainnet, instrument, interval)
          : await fetchFeedCandles(mainnet, instrument, interval, indexer);
      row[`${interval}s`] = describe(candles);
      if (candles.kind === "history") sourceOf.set(instrument.id, candles.source.text);
    } catch (error) {
      row[`${interval}s`] = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  rows.push({ ...row, source: sourceOf.get(instrument.id) ?? "—" });
}
console.log("candles per interval (* = older history not reached)");
console.table(rows);

// ---------------------------------------------------------------- 3. Perpl: chain vs REST
const [onchain, rest] = await Promise.all([
  readPerplMarkets(
    mainnet,
    PERPL_INSTRUMENTS.map((i) => i.perplMarketId),
  ),
  fetch(`${PERPL_API}/v1/market-data/ticker`).then((r) => r.json() as Promise<{ d: Record<string, { mrk: number }> }>),
]);
console.table(
  PERPL_INSTRUMENTS.map((i, k) => ({
    market: `${i.symbol} (${i.perplMarketId})`,
    onchainMark: onchain[k]?.markPNS.toString() ?? "—",
    restMark: String(rest.d[i.perplMarketId]?.mrk ?? "—"),
    markAt: onchain[k] ? iso(onchain[k].markTimestamp) : "—",
  })),
);
