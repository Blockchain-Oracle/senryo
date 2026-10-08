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
