import { FEED_PAGE_DEFAULT, type FeedItem, type FeedPage, type FeedQuery } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Db, HTTP_STATUS, HttpError } from "@senryo/service-common";
import { type PostRow, postColumns, postOf, viewerAccountFilter, viewerPostFilter } from "./posts.ts";
import { identityOf, visibleOn } from "./shared.ts";
import { sharedTrade, tradeOf } from "./trade-posts.ts";

/**
 * `GET /v1/feed` (S12b.4): `feed_events` newest first, keyset on id, merged in one table — indexed fills (kinds
 * `fill` / `position`) and theses. Visibility is decided at read time, so turning sharing or a listing off hides
 * rows at once:
 * - every row needs its actor visible on the network (listed, not moderation-hidden);
 * - a fill also needs the actor sharing trades there, and to have happened after sharing was turned on;
 * - a thesis needs its post present and not hidden;
 * - with a session: no accounts blocked either way, no muted accounts, no posts the viewer reported.
 * A trade row carries its trade post's likes and replies (F-D1) — zeros until someone first engages — and leaves the
 * feed when that post is hidden by an operator or reported by the viewer, as a thesis does.
 */

/** A feed row plus the post columns (`postColumns`; all null for a fill row, whose post LEFT JOIN is empty). */
type FeedRow = {
  event_id: bigint;
  event_kind: "fill" | "position" | "thesis";
  actor: string;
  event_market_id: string | null;
  event_position_id: string | null;
  occurred_at: Date;
  payload: Record<string, unknown>;
  anchor_id: string | null;
  anchor_likes: number;
  anchor_replies: number;
  anchor_liked: boolean;
} & { [K in keyof PostRow]: K extends "handle" | "display_name" | "avatar" ? PostRow[K] : PostRow[K] | null };

function itemOf(chainId: ChainId, row: FeedRow): FeedItem {
  const { id, kind, author, created_at } = row;
  const post =
    row.event_kind === "thesis" && id !== null && kind !== null && author !== null && created_at !== null
      ? postOf({
          ...row,
          id,
          chain_id: chainId,
          kind,
          author,
          created_at,
          parent_id: row.parent_id ?? null,
          market_id: row.market_id ?? null,
          position_id: row.position_id ?? null,
          text: row.text ?? "",
          likes: row.likes ?? 0,
          replies: row.replies ?? 0,
          liked: row.liked ?? false,
        })
      : null;
  return {
    id: row.event_id.toString(),
    kind: row.event_kind,
    chainId,
    at: row.occurred_at.toISOString(),
    actor: identityOf({ ...row, address: row.actor }),
    marketId: row.event_market_id,
    trade: row.event_kind === "thesis" ? null : tradeOf(row.payload, row.event_position_id),
    post,
    engagement:
      row.event_kind === "thesis"
        ? null
        : {
            postId: row.anchor_id,
            likes: row.anchor_likes,
            replies: row.anchor_replies,
            likedByMe: row.anchor_liked,
          },
  };
}

/** A trade row's post `pa` (when it exists): likes, visible replies, and whether `viewer` liked it. */
function anchorColumns(db: Db, chainId: ChainId, viewer: string | null) {
  return db`pa.id::text AS anchor_id,
    (SELECT count(*)::int FROM likes l WHERE l.post_id = pa.id) AS anchor_likes,
    (SELECT count(*)::int FROM posts r JOIN profiles ra ON ra.address = r.author
      WHERE r.parent_id = pa.id AND NOT r.hidden AND ${visibleOn(db, "ra", chainId)}) AS anchor_replies,
    EXISTS (SELECT 1 FROM likes l WHERE l.post_id = pa.id AND l.address = ${viewer ?? ""}) AS anchor_liked`;
}

export async function feedPage(db: Db, query: FeedQuery, viewer: string | null): Promise<FeedPage> {
  const { chainId } = query;
  if (query.scope === "friends" && viewer === null) {
    throw new HttpError(HTTP_STATUS.unauthorized, "UNAUTHORIZED", "sign in to see your Following feed");
  }
  const limit = query.limit ?? FEED_PAGE_DEFAULT;
  const sharing = sharedTrade(db, chainId, "e", "a");
  const market = query.market === undefined ? db`` : db`AND e.market_id = ${query.market}`;
  const friends =
    query.scope === "friends" ? db`AND e.actor IN (SELECT followee FROM follows WHERE follower = ${viewer})` : db``;
  const actor = query.actor === undefined ? db`` : db`AND e.actor = ${query.actor.toLowerCase()}`;
  const before = query.cursor === undefined ? db`` : db`AND e.id < ${BigInt(query.cursor)}`;
  const rows = await db<FeedRow[]>`
    SELECT e.id AS event_id, e.kind AS event_kind, e.actor, e.market_id AS event_market_id, e.occurred_at, e.payload,
           e.position_id AS event_position_id, ${postColumns(db, chainId, viewer)}, ${anchorColumns(db, chainId, viewer)}
      FROM feed_events e
      JOIN profiles a ON a.address = e.actor
      LEFT JOIN posts po ON po.id = e.post_id
      LEFT JOIN posts pa ON pa.feed_event_id = e.id
     WHERE e.chain_id = ${chainId} AND ${visibleOn(db, "a", chainId)}
       AND ((e.kind = 'thesis' AND po.id IS NOT NULL AND NOT po.hidden)
            OR (e.kind <> 'thesis' AND ${sharing} AND (pa.id IS NULL OR NOT pa.hidden)))
       ${market} ${friends} ${actor} ${before}
       ${viewerAccountFilter(db, viewer, "e", "actor")} ${viewerPostFilter(db, viewer, "e", "post_id")}
       ${viewerPostFilter(db, viewer, "pa", "id")}
     ORDER BY e.id DESC
     LIMIT ${limit + 1}`;
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => itemOf(chainId, r)),
    nextCursor: rows.length > limit ? (page.at(-1)?.event_id.toString() ?? null) : null,
  };
}
