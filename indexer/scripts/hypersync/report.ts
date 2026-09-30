/** Turns the aggregates into the JSON report: per-perp pool stats, liquidation heatmap, PnL leaderboard. */
import type { Aggregates, PerpMeta, PerpStats } from "./types.ts";

const HEATMAP_BUCKETS = 10;
const LEADERBOARD_SIZE = 10;
const TOP_PERPS = 25;

/** Liquidated notional per price band: HEATMAP_BUCKETS equal bands between the lowest and highest liq price. */
function heatmap(stats: PerpStats, meta: PerpMeta) {
  if (stats.liqPrices.length === 0) return [];
  const prices = stats.liqPrices.map((l) => l.price);
  const lo = prices.reduce((a, b) => (a < b ? a : b));
  const hi = prices.reduce((a, b) => (a > b ? a : b));
  const width = (hi - lo) / BigInt(HEATMAP_BUCKETS) || 1n;
  const bands = Array.from({ length: HEATMAP_BUCKETS }, (_, i) => ({
    fromPrice: lo + width * BigInt(i),
    notional: 0n,
    count: 0,
  }));
  for (const { price, notional } of stats.liqPrices) {
    const index = Math.min(HEATMAP_BUCKETS - 1, Number((price - lo) / width));
    const band = bands[index];
    if (!band) continue;
    band.notional += notional;
    band.count += 1;
  }
  return bands.filter((b) => b.count > 0).map((b) => ({ ...b, priceDecimals: meta.priceDecimals }));
}

export function summarize(input: { head: number; from: number; perps: Map<string, PerpMeta>; agg: Aggregates }) {
  const { head, from, perps, agg } = input;
  const rows = [...agg.perps.entries()]
    .map(([perpId, s]) => {
      const meta = perps.get(perpId);
      return {
        perpId,
        symbol: meta?.symbol ?? perpId,
        volumeUsd6: s.volume,
        fills: s.fills,
        feesUsd6: s.fees,
        liquidations: s.liquidations,
        liquidatedNotionalUsd6: s.liquidatedNotional,
        fundingEvents: s.fundingEvents,
        avgAbsFundingRatePct100k: s.fundingEvents === 0 ? 0n : s.fundingAbsRateSum / BigInt(s.fundingEvents),
        liquidationHeatmap: meta ? heatmap(s, meta) : [],
      };
    })
    .sort((a, b) => (a.volumeUsd6 === b.volumeUsd6 ? 0 : a.volumeUsd6 > b.volumeUsd6 ? -1 : 1))
    .slice(0, TOP_PERPS);
  const pnl = [...agg.pnlByAccount.entries()].sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1));
  const totals = rows.reduce(
    (t, r) => ({
      volumeUsd6: t.volumeUsd6 + r.volumeUsd6,
      fills: t.fills + r.fills,
      liquidations: t.liquidations + r.liquidations,
    }),
    { volumeUsd6: 0n, fills: 0, liquidations: 0 },
  );
  return {
    source: "HyperSync monad.hypersync.xyz · Perpl Exchange 0x34B6…2a6F",
    window: { fromBlock: from, toBlock: head, blocks: head - from },
    totals,
    perps: rows,
    topAccountsByRealizedPnl: pnl.slice(0, LEADERBOARD_SIZE).map(([accountId, usd6]) => ({ accountId, usd6 })),
    bottomAccountsByRealizedPnl: pnl
      .slice(-LEADERBOARD_SIZE)
      .reverse()
      .map(([accountId, usd6]) => ({ accountId, usd6 })),
  };
}
