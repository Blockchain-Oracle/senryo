import { type ChainId, MAINNET_CHAIN_ID } from "@senryo/config";
import type { Db, Tx } from "./db.ts";

/** Shared by public reads, notification ingest and delivery: one network visibility policy. */
export function listedColumn(chainId: ChainId): "listed_mainnet" | "listed_practice" {
  return chainId === MAINNET_CHAIN_ID ? "listed_mainnet" : "listed_practice";
}

export function publicTradesColumn(chainId: ChainId): "public_trades_mainnet" | "public_trades_practice" {
  return chainId === MAINNET_CHAIN_ID ? "public_trades_mainnet" : "public_trades_practice";
}

export function sharingSinceColumn(chainId: ChainId): "public_trades_mainnet_since" | "public_trades_practice_since" {
  return chainId === MAINNET_CHAIN_ID ? "public_trades_mainnet_since" : "public_trades_practice_since";
}

export function visibleOn(db: Db | Tx, alias: string, chainId: ChainId) {
  return db`${db(alias)}.${db(listedColumn(chainId))} AND NOT ${db(alias)}.hidden`;
}

export function sharingOn(db: Db | Tx, alias: string, chainId: ChainId) {
  return db`${visibleOn(db, alias, chainId)} AND ${db(alias)}.${db(publicTradesColumn(chainId))}`;
}

/** A queued followed-open alert must still refer to a trade the recipient may see, and their original follow. */
export function followedTradeVisible(db: Db | Tx, chainId: ChainId, alias: string) {
  return db`(${db(alias)}.channel <> 'followedTrades' OR EXISTS (
    SELECT 1 FROM feed_events e JOIN profiles a ON a.address = e.actor
      JOIN follows f ON f.followee = e.actor AND f.follower = ${db(alias)}.user_address
      LEFT JOIN posts pa ON pa.feed_event_id = e.id
     WHERE e.chain_id = ${chainId} AND e.payload->>'fillKind' = 'OPEN'
       AND ${db(alias)}.event_key = ${`${chainId}:opened:`} || e.id::text || ':' || f.follower
       AND ${sharingOn(db, "a", chainId)}
       AND a.${db(sharingSinceColumn(chainId))} <= e.occurred_at
       AND f.created_at <= e.occurred_at
       AND (pa.id IS NULL OR NOT pa.hidden)
       AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.reporter = f.follower
                        AND r.target_kind = 'post' AND r.target_id = pa.id::text)
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = f.follower AND b.blocked = f.followee)
                                                OR (b.blocker = f.followee AND b.blocked = f.follower))
       AND NOT EXISTS (SELECT 1 FROM mutes m WHERE m.muter = f.follower AND m.muted = f.followee)
  ))`;
}
