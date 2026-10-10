import type { Hex } from "@senryo/chain";
import type { Db } from "./db.ts";

/**
 * Reading the `pyth_prints` archive (the api's gateway writes it, D-272): the unique print of an instant with the
 * update bytes the chain verifies. The keeper settles and fills from here, so it never needs the Pyth key.
 */
export interface ArchivedPrint {
  feedId: Hex;
  t: number;
  publishTime: number;
  prevPublishTime: number;
  price: bigint;
  conf: bigint;
  expo: number;
  updates: Hex[];
  recordedAt: number;
}

export async function archivedPrint(db: Db, feedId: Hex, t: number): Promise<ArchivedPrint | undefined> {
  const [row] = await db<
    {
      publish_time: bigint;
      prev_publish_time: bigint;
      price: bigint;
      conf: bigint;
      expo: number;
      update_hex: string;
      recorded_at: Date;
    }[]
  >`SELECT publish_time, prev_publish_time, price, conf, expo, update_hex, recorded_at
    FROM pyth_prints WHERE feed_id = ${feedId} AND t = ${t}`;
  if (!row) return undefined;
  return {
    feedId,
    t,
    publishTime: Number(row.publish_time),
    prevPublishTime: Number(row.prev_publish_time),
    price: row.price,
    conf: row.conf,
    expo: row.expo,
    updates: row.update_hex.split(",") as Hex[],
    recordedAt: row.recorded_at.getTime(),
  };
}

/** The archive's key for a print. */
export function printKey(feedId: string, t: number | bigint): string {
  return `${feedId}:${t}`;
}

/**
 * Instants in (sinceSec, untilSec] whose print a live position needs (04-pricing R3): fill and close targets, the
 * starts and expiries of tickets not yet final, and the same for parlays and their legs. Every chain at once — the
 * api's one gateway archives for all of them.
 */
export async function instantsAwaitingPrints(db: Db, sinceSec: number, untilSec: number) {
  return db<{ series_id: string; t: bigint }[]>`
    SELECT DISTINCT series_id, t FROM (
      SELECT series_id, target AS t FROM market_tickets
        WHERE state IN ('committed', 'closing') AND target IS NOT NULL
      UNION ALL
      SELECT series_id, window_start FROM market_tickets WHERE state IN ('committed', 'open', 'closing')
      UNION ALL
      SELECT series_id, window_expiry FROM market_tickets WHERE state IN ('committed', 'open', 'closing')
      UNION ALL
      SELECT l.series_id, p.target FROM market_parlays p
        JOIN market_parlay_legs l ON l.chain_id = p.chain_id AND l.parlay_id = p.parlay_id
        WHERE p.state = 'committed' AND p.target IS NOT NULL
      UNION ALL
      SELECT l.series_id, l.window_start FROM market_parlays p
        JOIN market_parlay_legs l ON l.chain_id = p.chain_id AND l.parlay_id = p.parlay_id
        WHERE p.state IN ('committed', 'open')
      UNION ALL
      SELECT l.series_id, l.window_expiry FROM market_parlays p
        JOIN market_parlay_legs l ON l.chain_id = p.chain_id AND l.parlay_id = p.parlay_id
        WHERE p.state IN ('committed', 'open') AND l.outcome = 'pending'
    ) wanted WHERE t > ${sinceSec} AND t <= ${untilSec}`;
}

/** Which of these (feed, t) the archive already holds, as `printKey`s (one primary-key lookup). */
export async function archivedKeys(db: Db, wanted: readonly { feedId: string; t: number }[]): Promise<Set<string>> {
  if (wanted.length === 0) return new Set();
  const feeds = [...new Set(wanted.map((w) => w.feedId))];
  const ts = [...new Set(wanted.map((w) => w.t))];
  const rows = await db<{ feed_id: string; t: bigint }[]>`
    SELECT feed_id, t FROM pyth_prints WHERE feed_id IN ${db(feeds)} AND t IN ${db(ts)}`;
  return new Set(rows.map((r) => printKey(r.feed_id, r.t)));
}
