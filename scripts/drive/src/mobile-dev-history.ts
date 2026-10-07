/** Bounded real local-oracle observations. Never synthesize prices or fill empty time buckets. */
const MAX_OBSERVATIONS = 1440;
const MAX_CANDLES = 500;
const MAX_INTERVAL_SEC = 86_400;

interface Observation {
  at: number;
  price: bigint;
}
export class LocalOracleHistory {
  private readonly series = new Map<string, Observation[]>();

  record(symbol: string, at: number, price: bigint): void {
    if (!Number.isSafeInteger(at) || at <= 0 || price <= 0n) throw new Error("Invalid oracle observation");
    const rows = this.series.get(symbol) ?? [];
    const last = rows.at(-1);
    if (last && at < last.at) throw new Error("Oracle time moved backwards without reset");
    if (last?.at === at) {
      // A single source timestamp has one latest answer, not an invented extra tick.
      rows[rows.length - 1] = { at, price };
    } else rows.push({ at, price });
    if (rows.length > MAX_OBSERVATIONS) rows.splice(0, rows.length - MAX_OBSERVATIONS);
    this.series.set(symbol, rows);
  }

  clear(): void {
    this.series.clear();
  }

  candles(symbol: string, interval: number, since: number) {
    if (!Number.isSafeInteger(interval) || interval <= 0 || interval > MAX_INTERVAL_SEC || !Number.isSafeInteger(since))
      throw new Error("Invalid candle window");
    const buckets = new Map<
      number,
      {
        openTime: number;
        open: bigint;
        high: bigint;
        low: bigint;
        close: bigint;
        roundCount: number;
        fillCount: number;
        volume: bigint;
      }
    >();
    for (const row of this.series.get(symbol) ?? []) {
      const openTime = Math.floor(row.at / interval) * interval;
      if (openTime < since) continue;
      const bucket = buckets.get(openTime);
      if (bucket) {
        bucket.high = row.price > bucket.high ? row.price : bucket.high;
        bucket.low = row.price < bucket.low ? row.price : bucket.low;
        bucket.close = row.price;
        bucket.roundCount += 1;
      } else
        buckets.set(openTime, {
          openTime,
          open: row.price,
          high: row.price,
          low: row.price,
          close: row.price,
          roundCount: 1,
          fillCount: 0,
          volume: 0n,
        });
    }
    // CandlesDocument expects newest first and validates/normalizes at the client boundary.
    return { Candle: [...buckets.values()].reverse().slice(0, MAX_CANDLES) };
  }
}
