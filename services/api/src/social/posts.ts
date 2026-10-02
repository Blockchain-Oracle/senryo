import { randomUUID } from "node:crypto";
import { type LikeState, type Post, type PostCreate, REPLIES_PAGE_DEFAULT, type Thread } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Db, HTTP_STATUS, HttpError, MS_PER_SECOND, type Tx } from "@senryo/service-common";
import { LOCK_NS, POST_BUDGET_WINDOW_SEC, POSTS_PER_HOUR } from "./constants.ts";
import type { SocialIndexer } from "./indexer-source.ts";
import { textHasBlockedWord } from "./moderation.ts";
import { advisoryLock, identityOf, visibleOn } from "./shared.ts";
import { tradeOfPost, tradePostShown } from "./trade-posts.ts";

/**
 * Posts (S12b.6): theses, trade posts (F-D1, `trade-posts.ts`) and one-level replies per network. Readers only ever
 * see a post whose author is visible on that network and that no operator hid — and a trade post only while its trade
 * is public; with a session they also stop seeing accounts blocked either way, accounts they muted and posts they
 * reported.
 */

export interface PostRow {
  id: string;
  chain_id: number;
  kind: "thesis" | "reply" | "trade";
  parent_id: string | null;
  author: string;
  market_id: string | null;
  position_id: string | null;
  text: string;
  created_at: Date;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
  likes: number;
  replies: number;
  liked: boolean;
}

/** The selected columns of a visible post `po` by author `a` (likes, visible replies, `liked` by `viewer`). */
export function postColumns(db: Db | Tx, chainId: ChainId, viewer: string | null) {
  return db`po.id, po.chain_id, po.kind, po.parent_id, po.author, po.market_id, po.position_id, po.text, po.created_at,
    a.handle, a.display_name, a.avatar,
    (SELECT count(*)::int FROM likes l WHERE l.post_id = po.id) AS likes,
    (SELECT count(*)::int FROM posts r JOIN profiles ra ON ra.address = r.author
      WHERE r.parent_id = po.id AND NOT r.hidden AND ${visibleOn(db, "ra", chainId)}) AS replies,
    EXISTS (SELECT 1 FROM likes l WHERE l.post_id = po.id AND l.address = ${viewer ?? ""}) AS liked`;
}

/**
 * With a session: leave out accounts blocked either way and — for feed and thread content, not lookups like search —
 * accounts the viewer muted (`alias.column` = the account column).
 */
export function viewerAccountFilter(
  db: Db | Tx,
  viewer: string | null,
  alias: string,
  column: string,
  mutes: "hide" | "show" = "hide",
) {
  if (viewer === null) return db``;
  const actor = db`${db(alias)}.${db(column)}`;
  const muted =
    mutes === "hide"
      ? db`AND NOT EXISTS (SELECT 1 FROM mutes m WHERE m.muter = ${viewer} AND m.muted = ${actor})`
      : db``;
  return db`AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = ${viewer} AND b.blocked = ${actor})
                                                    OR (b.blocker = ${actor} AND b.blocked = ${viewer}))
            ${muted}`;
}

/** With a session: leave out posts the viewer reported (`postId` = a qualified uuid column). */
export function viewerPostFilter(db: Db | Tx, viewer: string | null, alias: string, column: string) {
  if (viewer === null) return db``;
  return db`AND NOT EXISTS (SELECT 1 FROM reports rp WHERE rp.reporter = ${viewer} AND rp.target_kind = 'post'
                              AND rp.target_id = ${db(alias)}.${db(column)}::text)`;
}

export function postOf(row: PostRow): Post {
  return {
    id: row.id,
    chainId: row.chain_id as ChainId,
    kind: row.kind,
    parentId: row.parent_id,
    author: identityOf({ ...row, address: row.author }),
    marketId: row.market_id,
    positionId: row.position_id,
    text: row.text,
    likes: row.likes,
    replies: row.kind === "reply" ? 0 : row.replies,
    likedByMe: row.liked,
    createdAt: row.created_at.toISOString(),
  };
}

async function visiblePost(db: Db, chainId: ChainId, id: string, viewer: string | null): Promise<PostRow | undefined> {
  const [row] = await db<PostRow[]>`
    SELECT ${postColumns(db, chainId, viewer)}
      FROM posts po JOIN profiles a ON a.address = po.author
     WHERE po.id = ${id} AND po.chain_id = ${chainId} AND NOT po.hidden AND ${visibleOn(db, "a", chainId)}
       AND ${tradePostShown(db, chainId, "po", "a")}
       ${viewerAccountFilter(db, viewer, "po", "author")} ${viewerPostFilter(db, viewer, "po", "id")}`;
  return row;
}

/** A post as `viewer` sees it, or undefined when they can't (the trade-post route's read-back). */
export async function readPost(db: Db, chainId: ChainId, id: string, viewer: string | null) {
  const row = await visiblePost(db, chainId, id, viewer);
  return row ? postOf(row) : undefined;
}

function blockedBetween(tx: Tx, a: string, b: string) {
  return tx<{ blocked: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM blocks WHERE (blocker = ${a} AND blocked = ${b})
                                         OR (blocker = ${b} AND blocked = ${a})) AS blocked`;
}

/** The post a reply answers: visible, a thesis or trade post, same network, and no block between the two authors. */
async function checkParent(tx: Tx, chainId: ChainId, author: string, parentId: string): Promise<void> {
  const [parent] = await tx<{ kind: string; author: string }[]>`
    SELECT po.kind, po.author FROM posts po JOIN profiles a ON a.address = po.author
     WHERE po.id = ${parentId} AND po.chain_id = ${chainId} AND NOT po.hidden AND ${visibleOn(tx, "a", chainId)}
       AND ${tradePostShown(tx, chainId, "po", "a")}`;
  if (!parent) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such post on this network");
  if (parent.kind === "reply") {
    throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "reply to the thesis or trade, not to a reply");
  }
  const [state] = await blockedBetween(tx, author, parent.author);
  if (state?.blocked)
    throw new HttpError(HTTP_STATUS.forbidden, "BLOCKED", "a block is in place between these accounts");
}

/**
 * At most POSTS_PER_HOUR posts per account per rolling hour (exact: the caller holds the author's post lock). Trade
 * posts don't count: other people's first likes create them, and the trader wrote nothing.
 */
async function checkBudget(tx: Tx, author: string): Promise<void> {
  const [row] = await tx<{ n: number; oldest: Date | null }[]>`
    SELECT count(*)::int AS n, min(created_at) AS oldest FROM posts
     WHERE author = ${author} AND kind <> 'trade'
       AND created_at > now() - make_interval(secs => ${POST_BUDGET_WINDOW_SEC})`;
  if (!row || row.n < POSTS_PER_HOUR || !row.oldest) return;
  const wait = Math.ceil((row.oldest.getTime() + POST_BUDGET_WINDOW_SEC * MS_PER_SECOND - Date.now()) / MS_PER_SECOND);
  throw new HttpError(HTTP_STATUS.tooMany, "RATE_LIMITED", "posting too fast; try later", Math.max(wait, 0));
}

/**
 * Write a thesis or reply. The author must be visible on that network (403 NOT_LISTED), the text passes the content
 * filter, and an attached position must be the author's own on that network (checked against the indexer).
 */
export async function createPost(
  db: Db,
  indexer: SocialIndexer,
  author: string,
  input: PostCreate,
): Promise<{ post: Post; feedId: bigint | null }> {
  const text = input.text.trim();
  if (text === "") throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "a post needs text");
  if (textHasBlockedWord(text)) {
    throw new HttpError(HTTP_STATUS.badRequest, "CONTENT_BLOCKED", "text is not allowed", undefined, { field: "text" });
  }
  let marketId = input.marketId ?? null;
  if (input.positionId !== undefined) {
    const owner = await indexer.positionOwner(input.chainId, input.positionId).catch(() => {
      throw new HttpError(HTTP_STATUS.unavailable, "UPSTREAM_UNAVAILABLE", "can't verify the position right now");
    });
    if (!owner || owner.user_id.toLowerCase() !== author) {
      throw new HttpError(HTTP_STATUS.forbidden, "FORBIDDEN", "attach only your own position on this network");
    }
    if (marketId !== null && marketId !== owner.market.id) {
      throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "the position is on another market");
    }
    marketId = owner.market.id;
  }
  return db.begin(async (tx) => {
    await advisoryLock(tx, LOCK_NS.post, author);
    const [me] = await tx<{ ok: boolean }[]>`
      SELECT ${visibleOn(tx, "p", input.chainId)} AS ok FROM profiles p WHERE p.address = ${author}`;
    if (!me?.ok) throw new HttpError(HTTP_STATUS.forbidden, "NOT_LISTED", "list your profile on this network to post");
    if (input.parentId !== undefined) await checkParent(tx, input.chainId, author, input.parentId);
    await checkBudget(tx, author);
    const id = randomUUID();
    const [saved] = await tx<{ created_at: Date }[]>`
      INSERT INTO posts (id, chain_id, author, kind, parent_id, position_id, market_id, text)
      VALUES (${id}, ${input.chainId}, ${author}, ${input.kind}, ${input.parentId ?? null}, ${input.positionId ?? null},
              ${marketId}, ${text})
      RETURNING created_at`;
    if (!saved) throw new HttpError(HTTP_STATUS.internal, "INTERNAL", "post not stored");
    let feedId: bigint | null = null;
    if (input.kind === "thesis") {
      const [event] = await tx<{ id: bigint }[]>`
        INSERT INTO feed_events (chain_id, source_id, kind, actor, market_id, position_id, post_id, occurred_at)
        VALUES (${input.chainId}, ${`post:${id}`}, 'thesis', ${author}, ${marketId}, ${input.positionId ?? null}, ${id},
                ${saved.created_at})
        RETURNING id`;
      feedId = event?.id ?? null;
    }
    const [row] = await tx<PostRow[]>`
      SELECT ${postColumns(tx, input.chainId, author)} FROM posts po JOIN profiles a ON a.address = po.author
       WHERE po.id = ${id}`;
    if (!row) throw new HttpError(HTTP_STATUS.internal, "INTERNAL", "post not readable");
    return { post: postOf(row), feedId };
  });
}

/**
 * A post and, for a thesis or trade post, one page of its visible replies (oldest first) — a trade post's thread also
 * carries its trade. Undefined when not visible.
 */
export async function readThread(
  db: Db,
  chainId: ChainId,
  id: string,
  viewer: string | null,
  cursor: string | undefined,
  limit: number = REPLIES_PAGE_DEFAULT,
): Promise<Thread | undefined> {
  const post = await visiblePost(db, chainId, id, viewer);
  if (!post) return undefined;
  if (post.kind === "reply") return { post: postOf(post), replies: [], nextCursor: null, trade: null };
  const trade = post.kind === "trade" ? await tradeOfPost(db, id) : null;
  // Keyset on creation time in whole microseconds (Postgres' own precision, so no float rounding).
  const micros = db`(extract(epoch FROM po.created_at) * 1000000)::bigint`;
  const after = cursor === undefined ? db`` : db`AND ${micros} > ${cursor}::bigint`;
  const rows = await db<(PostRow & { at_us: string })[]>`
    SELECT ${postColumns(db, chainId, viewer)}, ${micros}::text AS at_us
      FROM posts po JOIN profiles a ON a.address = po.author
     WHERE po.parent_id = ${id} AND NOT po.hidden AND ${visibleOn(db, "a", chainId)} ${after}
       ${viewerAccountFilter(db, viewer, "po", "author")} ${viewerPostFilter(db, viewer, "po", "id")}
     ORDER BY po.created_at, po.id
     LIMIT ${limit + 1}`;
  const page = rows.slice(0, limit);
  return {
    post: postOf(post),
    replies: page.map(postOf),
    nextCursor: rows.length > limit ? (page.at(-1)?.at_us ?? null) : null,
    trade,
  };
}

/**
 * The author deletes their own post; a thesis takes its replies, likes and feed row with it (FK cascades). A trade
 * post can't be deleted: the trade is onchain (turning sharing off hides it).
 */
export async function deletePost(db: Db, author: string, id: string): Promise<boolean> {
  const rows = await db`DELETE FROM posts WHERE id = ${id} AND author = ${author} AND kind <> 'trade' RETURNING id`;
  return rows.length > 0;
}

/** Like / unlike (idempotent). A block either way between liker and author is 403 BLOCKED. */
export async function setLike(db: Db, chainId: ChainId, me: string, id: string, liked: boolean): Promise<LikeState> {
  return db.begin(async (tx) => {
    const [post] = await tx<{ author: string }[]>`
      SELECT po.author FROM posts po JOIN profiles a ON a.address = po.author
       WHERE po.id = ${id} AND NOT po.hidden AND ${visibleOn(tx, "a", chainId)} AND po.chain_id = ${chainId}
         AND ${tradePostShown(tx, chainId, "po", "a")}`;
    if (!post) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such post on this network");
    if (liked) {
      const [state] = await blockedBetween(tx, me, post.author);
      if (state?.blocked) {
        throw new HttpError(HTTP_STATUS.forbidden, "BLOCKED", "a block is in place between these accounts");
      }
      await tx`INSERT INTO likes (post_id, address) VALUES (${id}, ${me}) ON CONFLICT DO NOTHING`;
    } else {
      await tx`DELETE FROM likes WHERE post_id = ${id} AND address = ${me}`;
    }
    const [count] = await tx<{ n: number; mine: boolean }[]>`
      SELECT count(*)::int AS n, bool_or(address = ${me}) AS mine FROM likes WHERE post_id = ${id}`;
    return { postId: id, liked: count?.mine ?? false, likes: count?.n ?? 0 };
  });
}
