import { randomUUID } from "node:crypto";
import type { FeedTrade, Post } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Db, HTTP_STATUS, HttpError, type Tx } from "@senryo/service-common";
import { publicTradesColumn, sharingSinceColumn, visibleOn } from "./shared.ts";

/**
 * Trade posts (F-D1, migration 0011): a feed trade row's post, so a trade is liked, replied to, reported and shared
 * through the same tables and routes as a thesis. One per row (`posts.feed_event_id` is unique), created on first
 * use, authored by the trader, no text of its own. It is shown exactly while its row is: the trader visible on the
 * row's network, sharing trades there, and the fill made after sharing began.
 */

/** Feed row `e` by actor profile `a` is a public trade on `chainId` (sharing on, and the fill made since). */
export function sharedTrade(db: Db | Tx, chainId: ChainId, e: string, a: string) {
  return db`${db(a)}.${db(publicTradesColumn(chainId))}
            AND ${db(e)}.occurred_at >= ${db(a)}.${db(sharingSinceColumn(chainId))}`;
}

/** Post `po` by author profile `a`: anything but a trade post, or a trade post whose row is still public. */
export function tradePostShown(db: Db | Tx, chainId: ChainId, po: string, a: string) {
  return db`(${db(po)}.kind <> 'trade' OR EXISTS (
    SELECT 1 FROM feed_events te WHERE te.id = ${db(po)}.feed_event_id AND ${sharedTrade(db, chainId, "te", a)}))`;
}

const str = (value: unknown): string => (typeof value === "string" ? value : String(value ?? ""));
const big = (value: unknown): bigint => BigInt(str(value));

/** A stored fill payload (the poller's jsonb) as the api shows it. */
export function tradeOf(payload: Record<string, unknown>, positionId: string | null): FeedTrade {
  return {
    venue: payload.venue as FeedTrade["venue"],
    fillKind: payload.fillKind as FeedTrade["fillKind"],
    side: payload.side as FeedTrade["side"],
    symbol: str(payload.symbol),
    size: big(payload.size),
    price: payload.price === null || payload.price === undefined ? null : big(payload.price),
    notional: big(payload.notional),
    fee: big(payload.fee),
    realizedPnl: big(payload.realizedPnl),
    funding: big(payload.funding),
    borrow: big(payload.borrow),
    positionId: positionId ?? "",
    positionStatus: (payload.positionStatus ?? null) as FeedTrade["positionStatus"],
    positionNetPnl:
      payload.positionNetPnl === null || payload.positionNetPnl === undefined ? null : big(payload.positionNetPnl),
    txHash: str(payload.txHash) as FeedTrade["txHash"],
    block: Number(payload.block ?? 0),
  };
}

/** The trade a trade post is about, or null when `postId` isn't a trade post. */
export async function tradeOfPost(db: Db, postId: string): Promise<FeedTrade | null> {
  const [row] = await db<{ payload: Record<string, unknown>; position_id: string | null }[]>`
    SELECT e.payload, e.position_id FROM posts po JOIN feed_events e ON e.id = po.feed_event_id
     WHERE po.id = ${postId} AND po.kind = 'trade'`;
  return row ? tradeOf(row.payload, row.position_id) : null;
}

interface EventRow {
  id: bigint;
  chain_id: number;
  actor: string;
  market_id: string | null;
  position_id: string | null;
  occurred_at: Date;
  shown: boolean;
}

/**
 * The trade post of feed row `eventId`, created when it doesn't exist yet (concurrent first uses converge on one row).
 * 404 when the row isn't a public trade on its network. `read` returns it as `viewer` sees it (likes, filters), so a
 * viewer who blocked or muted the trader, or reported the post, gets 404 as for any post they can't see.
 */
export async function tradePost(
  db: Db,
  eventId: bigint,
  read: (chainId: ChainId, id: string) => Promise<Post | undefined>,
): Promise<Post> {
  const [kind] = await db<{ chain_id: number; kind: string }[]>`
    SELECT chain_id, kind FROM feed_events WHERE id = ${eventId}`;
  const missing = new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such trade on this network");
  if (!kind || kind.kind === "thesis") throw missing;
  const chainId = kind.chain_id as ChainId;
  const [event] = await db<EventRow[]>`
    SELECT e.id, e.chain_id, e.actor, e.market_id, e.position_id, e.occurred_at,
           (${visibleOn(db, "a", chainId)} AND ${sharedTrade(db, chainId, "e", "a")}) AS shown
      FROM feed_events e JOIN profiles a ON a.address = e.actor
     WHERE e.id = ${eventId}`;
  if (!event?.shown) throw missing;
  await db`
    INSERT INTO posts (id, chain_id, author, kind, parent_id, position_id, market_id, text, feed_event_id, created_at)
    VALUES (${randomUUID()}, ${chainId}, ${event.actor}, 'trade', NULL, ${event.position_id}, ${event.market_id}, '',
            ${event.id}, ${event.occurred_at})
    ON CONFLICT (feed_event_id) DO NOTHING`;
  const [anchor] = await db<{ id: string }[]>`SELECT id FROM posts WHERE feed_event_id = ${event.id}`;
  const post = anchor ? await read(chainId, anchor.id) : undefined;
  if (!post) throw missing;
  return post;
}
