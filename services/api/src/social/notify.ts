import { type Address, getAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import {
  appLink,
  type Db,
  MS_PER_SECOND,
  type NotificationMessage,
  notificationKey,
  personText,
  pushTitle,
  recordNotification,
} from "@senryo/service-common";
import type { FastifyBaseLogger } from "fastify";
import { FOLLOWED_OPEN_FRESH_SEC, NOTIFY_EXCERPT_MAX_CHARS } from "./constants.ts";
import { visibleOn } from "./shared.ts";

/**
 * Social notifications (G1, channel `social` / `followedTrades`), recorded by the api where the action happens; the
 * keeper of that network pushes them. Each is recorded only when the recipient may see the actor: the actor is
 * visible on that network, no block stands either way, and the recipient hasn't muted the actor. The inbox gets the
 * row whatever the recipient's push switches say (they decide pushes); "a trader you follow opened a position" is
 * opt-in, so it is only recorded for followers who turned it on. Idempotent per event: following again, liking
 * again or a replayed feed page never notifies twice.
 */

interface ActorRow {
  address: string;
  handle: string | null;
  display_name: string | null;
}

const WHITESPACE = /\s+/g;

/** The actor as `recipient` may see them on `chainId`, or undefined when nothing may be recorded. */
async function visibleActor(db: Db, chainId: ChainId, recipient: string, actor: string) {
  if (recipient === actor) return undefined;
  const [row] = await db<ActorRow[]>`
    SELECT p.address, p.handle, p.display_name FROM profiles p
     WHERE p.address = ${actor} AND ${visibleOn(db, "p", chainId)}
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = ${recipient} AND b.blocked = ${actor})
                                                OR (b.blocker = ${actor} AND b.blocked = ${recipient}))
       AND NOT EXISTS (SELECT 1 FROM mutes m WHERE m.muter = ${recipient} AND m.muted = ${actor})`;
  return row ? personText({ address: row.address, handle: row.handle, displayName: row.display_name }) : undefined;
}

/** One line of a post, quoted and cut at NOTIFY_EXCERPT_MAX_CHARS. */
function excerpt(text: string): string {
  const line = text.replace(WHITESPACE, " ").trim();
  const cut = line.length > NOTIFY_EXCERPT_MAX_CHARS ? `${line.slice(0, NOTIFY_EXCERPT_MAX_CHARS - 1)}…` : line;
  return `“${cut}”`;
}

const threadLink = (chainId: ChainId, thesisId: string) => appLink(chainId, `social/post/${thesisId}`);

/** "@kai followed you" — on the network the follow was made on (follows are account-level). */
export async function notifyFollowed(db: Db, chainId: ChainId, follower: string, followee: string) {
  const who = await visibleActor(db, chainId, followee, follower);
  if (!who) return false;
  return recordNotification(db, {
    chainId,
    eventKey: `follow:${follower}:${followee}`,
    user: followee,
    channel: "social",
    title: pushTitle(chainId, `${who} followed you`),
    body: "See their trades and theses.",
    url: appLink(chainId, `watch/${follower}`),
    subject: { kind: "person", address: getAddress(follower) as Address },
  });
}

/** "@kai liked your thesis" — to the post's author, opening the thread. */
export async function notifyLiked(db: Db, chainId: ChainId, liker: string, postId: string) {
  const [post] = await db<{ author: string; kind: "thesis" | "reply"; parent_id: string | null; text: string }[]>`
    SELECT author, kind, parent_id, text FROM posts WHERE id = ${postId} AND chain_id = ${chainId}`;
  if (!post) return false;
  const who = await visibleActor(db, chainId, post.author, liker);
  if (!who) return false;
  return recordNotification(db, {
    chainId,
    eventKey: `like:${postId}:${liker}`,
    user: post.author,
    channel: "social",
    title: pushTitle(chainId, `${who} liked your ${post.kind}`),
    body: excerpt(post.text),
    url: threadLink(chainId, post.parent_id ?? postId),
    subject: { kind: "person", address: getAddress(liker) as Address },
  });
}

/** "@kai replied to your thesis" — to the thesis' author, with the reply's first line. */
export async function notifyReplied(db: Db, chainId: ChainId, replyId: string) {
  const [reply] = await db<{ author: string; text: string; parent_id: string; thesis_author: string }[]>`
    SELECT r.author, r.text, r.parent_id, t.author AS thesis_author
      FROM posts r JOIN posts t ON t.id = r.parent_id
     WHERE r.id = ${replyId} AND r.chain_id = ${chainId}`;
  if (!reply) return false;
  const who = await visibleActor(db, chainId, reply.thesis_author, reply.author);
  if (!who) return false;
  return recordNotification(db, {
    chainId,
    eventKey: `reply:${replyId}`,
    user: reply.thesis_author,
    channel: "social",
    title: pushTitle(chainId, `${who} replied to your thesis`),
    body: excerpt(reply.text),
    url: threadLink(chainId, reply.parent_id),
    subject: { kind: "person", address: getAddress(reply.author) as Address },
  });
}

/** A feed row the poller just wrote for an opening fill. */
export interface OpenedEvent {
  id: bigint;
  actor: string;
  marketId: string;
  side: string;
  symbol: string;
  occurredAt: Date;
}

function openedMessage(chainId: ChainId, who: string, e: OpenedEvent): NotificationMessage {
  return {
    title: pushTitle(chainId, `${who} opened a ${e.side.toLowerCase()} on ${e.symbol}`),
    body: "See the trade on their profile.",
    url: appLink(chainId, `watch/${e.actor}`),
    subject: { kind: "person", address: getAddress(e.actor) as Address, marketId: e.marketId },
  };
}

/**
 * "A trader you follow opened a position" (opt-in): one row per follower whose device keeps `followedTrades` on,
 * fanned out in one insert per event. Fills older than FOLLOWED_OPEN_FRESH_SEC (a backfill) notify nobody.
 */
export async function notifyFollowersOpened(db: Db, chainId: ChainId, events: readonly OpenedEvent[]) {
  let recorded = 0;
  for (const e of events) {
    if (e.occurredAt.getTime() < Date.now() - FOLLOWED_OPEN_FRESH_SEC * MS_PER_SECOND) continue;
    const [actor] = await db<ActorRow[]>`
      SELECT p.address, p.handle, p.display_name FROM profiles p
       WHERE p.address = ${e.actor} AND ${visibleOn(db, "p", chainId)}`;
    if (!actor) continue;
    const m = openedMessage(chainId, personText({ ...actor, displayName: actor.display_name }), e);
    // The same columns `recordNotification` writes, as a set: the key is `<chainId>:opened:<feed id>:<follower>`.
    const rows = await db`
      INSERT INTO push_sends (event_key, user_address, channel, chain_id, title, body, url, subject, next_attempt_at)
      SELECT ${notificationKey(chainId, `opened:${e.id}:`)} || f.follower, f.follower, 'followedTrades', ${chainId},
             ${m.title}, ${m.body}, ${m.url}, ${db.json(m.subject as never)}, now()
        FROM follows f
       WHERE f.followee = ${e.actor}
         AND EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_address = f.follower AND t.kind = 'expo'
                        AND t.disabled_at IS NULL AND t.ch_followed_trades)
         AND NOT EXISTS (SELECT 1 FROM mutes mu WHERE mu.muter = f.follower AND mu.muted = f.followee)
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = f.follower AND b.blocked = f.followee)
                                                  OR (b.blocker = f.followee AND b.blocked = f.follower))
      ON CONFLICT (event_key) DO NOTHING`;
    recorded += rows.count;
  }
  return recorded;
}

/** Runs a notification after the action succeeded: a failure is logged, never the action's error. */
export async function bestEffort(log: FastifyBaseLogger, what: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    log.warn({ err: String(error), what }, "notification not recorded");
  }
}
