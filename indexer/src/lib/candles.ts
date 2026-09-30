/**
 * OHLC candles from real prices only (D-020): every oracle round and every one of our fills is a tick; an interval
 * with neither has no row, so nothing is forward-filled or invented. Prices are 1e18.
 */
import { CANDLE_INTERVALS } from "./constants.ts";
import type { Ctx } from "./meta.ts";

export interface Tick {
  /** OracleFeed id (asset symbol, e.g. "XAU"). */
  feed: string;
  price: bigint;
  timestamp: number;
  source: "round" | "fill";
  /** usd6 notional for fills; 0 for rounds. */
  volume: bigint;
}

export async function recordTick(ctx: Ctx, tick: Tick): Promise<void> {
  if (tick.price <= 0n) return;
  const isRound = tick.source === "round";
  const rows = await Promise.all(
    CANDLE_INTERVALS.map(async (interval) => {
      const openTime = Math.floor(tick.timestamp / interval) * interval;
      const id = `${tick.feed}-${interval}-${openTime}`;
      return { id, interval, openTime, row: await ctx.Candle.get(id) };
    }),
  );
  for (const { id, interval, openTime, row } of rows) {
    ctx.Candle.set({
      id,
      feed_id: tick.feed,
      interval,
      openTime,
      open: row ? row.open : tick.price,
      high: row && row.high > tick.price ? row.high : tick.price,
      low: row && row.low < tick.price ? row.low : tick.price,
      close: tick.price,
      roundCount: (row?.roundCount ?? 0) + (isRound ? 1 : 0),
      fillCount: (row?.fillCount ?? 0) + (isRound ? 0 : 1),
      volume: (row?.volume ?? 0n) + tick.volume,
      updatedAt: tick.timestamp,
    });
  }
}
