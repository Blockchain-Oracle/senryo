import type { Hex } from "@senryo/chain";
import { archivedPrint, type Db, type Logger } from "@senryo/service-common";
import { BOUNDARY_SEC } from "./constants.ts";
import { type PriceUpdate, provesInstant, toE8 } from "./ring.ts";

/**
 * The `pyth_prints` archive and the 1-minute candles (D-272). Every window boundary (each minute) is archived the
 * moment its unique print streams in — Hermes forgets after ~640 s, the chain may need it later (settlement, a late
 * keeper, Proof). Fill instants are archived when the relay asks for them.
 */
export class PriceArchive {
  private readonly openCandles = new Map<
    Hex,
    { minute: number; open: bigint; high: bigint; low: bigint; close: bigint }
  >();

  constructor(
    private readonly db: Db,
    private readonly log: Logger,
  ) {}

  /** Each minute boundary this update proves (usually none or one). */
  boundariesOf(u: PriceUpdate): number[] {
    const out: number[] = [];
    const first = u.prevPublishTime + 1;
    for (
      let t = first + ((BOUNDARY_SEC - (first % BOUNDARY_SEC)) % BOUNDARY_SEC);
      t <= u.publishTime;
      t += BOUNDARY_SEC
    ) {
      if (provesInstant(u, t)) out.push(t);
    }
    return out;
  }

  async savePrint(u: PriceUpdate, t: number, source: "stream" | "rest"): Promise<void> {
    if (!provesInstant(u, t)) return;
    await this.db`
      INSERT INTO pyth_prints (feed_id, t, publish_time, prev_publish_time, price, conf, expo, update_hex, source)
      VALUES (${u.feedId}, ${t}, ${u.publishTime}, ${u.prevPublishTime}, ${u.price}, ${u.conf}, ${u.expo},
              ${u.updates.join(",")}, ${source})
      ON CONFLICT (feed_id, t) DO NOTHING`;
    await this.db`SELECT pg_notify('pyth_print', ${`${u.feedId}:${t}`})`;
  }

  async printAt(feedId: Hex, t: number): Promise<PriceUpdate | undefined> {
    const p = await archivedPrint(this.db, feedId, t);
    return p ? { ...p, receivedAt: p.recordedAt } : undefined;
  }

  /** Folds a price into its minute; a finished minute is written once (closed candles are immutable). */
  foldCandle(u: PriceUpdate): void {
    const minute = u.publishTime - (u.publishTime % BOUNDARY_SEC);
    const e8 = toE8(u.price, u.expo);
    const c = this.openCandles.get(u.feedId);
    if (!c || c.minute !== minute) {
      if (c && c.minute < minute) void this.writeCandle(u.feedId, c);
      this.openCandles.set(u.feedId, { minute, open: e8, high: e8, low: e8, close: e8 });
      return;
    }
    if (e8 > c.high) c.high = e8;
    if (e8 < c.low) c.low = e8;
    c.close = e8;
  }

  async candles(feedId: Hex, from: number, to: number) {
    return this.db<{ minute: bigint; open: bigint; high: bigint; low: bigint; close: bigint }[]>`
      SELECT minute, open, high, low, close FROM price_candles
      WHERE feed_id = ${feedId} AND minute >= ${from} AND minute <= ${to} ORDER BY minute`;
  }

  private async writeCandle(
    feedId: Hex,
    c: { minute: number; open: bigint; high: bigint; low: bigint; close: bigint },
  ) {
    try {
      await this.db`
        INSERT INTO price_candles (feed_id, minute, open, high, low, close)
        VALUES (${feedId}, ${c.minute}, ${c.open}, ${c.high}, ${c.low}, ${c.close})
        ON CONFLICT (feed_id, minute) DO NOTHING`;
    } catch (error) {
      this.log.warn({ err: (error as Error).message, feedId }, "candle write failed");
    }
  }
}
