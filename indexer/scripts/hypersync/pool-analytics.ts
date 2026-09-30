/**
 * "Creative HyperSync" analytics (plan §2.3, F-35): Perpl-wide market-pool history the indexer deliberately does not
 * store (it keeps only app users + taker volume since launch). One HyperSync stream over the Perpl Exchange computes,
 * per perp: maker-side volume (Σ maker fills = traded notional), trade count, liquidations with a liquidation-price
 * heatmap, funding stats, and an account realized-PnL leaderboard. Money stays bigint (usd6).
 *
 *   pnpm hypersync:pools [--days 30 | --from <block>] [--out perpl-pools.json]
 * Needs ENVIO_API_TOKEN (loaded from ~/.config/senryo/envio.env, never printed).
 */
import { writeFileSync } from "node:fs";
import { Decoder, HypersyncClient, type Log, type Query } from "@envio-dev/hypersync-client";
import { type AbiEvent, toEventSelector } from "viem";
import perplAbi from "../../abis/PerplExchange.json" with { type: "json" };
import { perplNotional } from "../../src/lib/perpl-math.ts";
import { summarize } from "./report.ts";
import { type Aggregates, emptyAggregates, type PerpMeta } from "./types.ts";

const HYPERSYNC_143 = "https://monad.hypersync.xyz";
const EXCHANGE = "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F";
const PERPL_DEPLOY_BLOCK = 54_773_010;
const BLOCKS_PER_DAY = 288_000; // 86 400 s / 0.3 s (measured Monad block time)
const DEFAULT_DAYS = 30;
const STREAM_CONCURRENCY = 8;

const token = process.env.ENVIO_API_TOKEN;
if (!token) throw new Error("ENVIO_API_TOKEN missing (see indexer/.env.example)");
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const events = (perplAbi as AbiEvent[]).filter((e) => e.type === "event");
const byName = new Map(events.map((e) => [e.name, e]));
const topic = (name: string): string => toEventSelector(byName.get(name) as AbiEvent);
const signature = (e: AbiEvent) =>
  `${e.name}(${e.inputs.map((i) => `${i.type}${i.indexed ? " indexed" : ""} ${i.name}`).join(", ")})`;
const decoder = Decoder.fromSignatures(events.map(signature));
const topicName = new Map<string, string>(events.map((e) => [topic(e.name), e.name]));

/** Named access to a decoded body (Perpl has no indexed params, so body order = ABI input order). */
function fields(name: string, body: ReadonlyArray<{ val: unknown }>): Record<string, bigint | string | boolean> {
  const out: Record<string, bigint | string | boolean> = {};
  byName.get(name)?.inputs.forEach((input, i) => {
    out[input.name ?? String(i)] = body[i]?.val as bigint | string | boolean;
  });
  return out;
}

const client = new HypersyncClient({ url: HYPERSYNC_143, apiToken: token });

async function scan(names: string[], fromBlock: number, onLog: (name: string, f: Record<string, unknown>) => void) {
  const query: Query = {
    fromBlock,
    logs: [{ address: [EXCHANGE], topics: [names.map(topic)] }],
    fieldSelection: { log: ["BlockNumber", "LogIndex", "Data", "Topic0"] },
  };
  const stream = await client.stream(query, { concurrency: STREAM_CONCURRENCY });
  for (let res = await stream.recv(); res !== null; res = await stream.recv()) {
    const logs: Log[] = res.data.logs;
    const decoded = await decoder.decodeLogs(logs);
    decoded.forEach((d, i) => {
      const name = topicName.get(logs[i]?.topics[0] ?? "");
      if (d && name) onLog(name, fields(name, d.body));
    });
  }
  await stream.close();
}

const head = await client.getHeight();
const from = arg("from") ? Number(arg("from")) : head - Number(arg("days") ?? DEFAULT_DAYS) * BLOCKS_PER_DAY;

// 1. Market metadata (decimals) from the deploy block — a handful of logs.
const perps = new Map<string, PerpMeta>();
await scan(["ContractAdded", "ContractAddedV2"], PERPL_DEPLOY_BLOCK, (_n, f) => {
  perps.set(String(f.perpId), {
    symbol: String(f.symbol),
    priceDecimals: Number(f.priceDecimals),
    lotDecimals: Number(f.lotDecimals),
  });
});

// 2. The window: fills, liquidations, funding, realized PnL.
const agg: Aggregates = emptyAggregates();
const perp = (id: unknown) => agg.perPerp(String(id));
await scan(
  [
    "MakerOrderFilledV2",
    "PositionLiquidated",
    "FundingEventCompleted",
    "PositionDecreased",
    "PositionClosed",
    "PositionInverted",
  ],
  from,
  (name, f) => {
    const meta = perps.get(String(f.perpId));
    if (!meta) return;
    const p = perp(f.perpId);
    if (name === "MakerOrderFilledV2") {
      p.volume += perplNotional(f.pricePNS as bigint, f.lotLNS as bigint, meta.priceDecimals, meta.lotDecimals);
      p.fills += 1;
      p.fees += (f.feeCNS as bigint) + (f.builderFeeCNS as bigint);
    } else if (name === "PositionLiquidated") {
      const notional = perplNotional(
        f.liqPricePNS as bigint,
        f.liqLotLNS as bigint,
        meta.priceDecimals,
        meta.lotDecimals,
      );
      p.liquidations += 1;
      p.liquidatedNotional += notional;
      p.liqPrices.push({ price: f.liqPricePNS as bigint, notional });
      agg.addPnl(String(f.posAccountId), f.deltaPnlCNS as bigint);
    } else if (name === "FundingEventCompleted") {
      const rate = f.actualRatePct100k as bigint;
      p.fundingEvents += 1;
      p.fundingAbsRateSum += rate < 0n ? -rate : rate;
    } else {
      agg.addPnl(String(f.accountId), f.deltaPnlCNS as bigint);
    }
  },
);

const report = summarize({ head, from, perps, agg });
const out = arg("out");
const json = JSON.stringify(report, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
if (out) writeFileSync(out, json);
else console.log(json);
