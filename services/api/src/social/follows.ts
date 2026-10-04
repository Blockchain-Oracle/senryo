import { FOLLOW_PAGE_DEFAULT, FOLLOWING_MAX, type FollowPage, type FollowState } from "@senryo/api-client";
import { type Address, getAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { type Db, HTTP_STATUS, HttpError } from "@senryo/service-common";
import { LOCK_NS } from "./constants.ts";
import { advisoryLock, listedColumn, rethrowDeadlock, visibleOn } from "./shared.ts";

/**
 * Follows (S12b.3). Account-level rows; every read that shows another account filters by the network's listing, so
 * an account unlisted on a network never appears in that network's lists, counts or `followsYou`.
 */

/** `me`'s relationship with `other` as seen on `chainId` (the session's network). */
export async function followState(db: Db, chainId: ChainId, me: string, other: string): Promise<FollowState> {
  const [row] = await db<{ following: boolean; follows_you: boolean; blocked: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM follows WHERE follower = ${me} AND followee = ${other}) AS following,
           EXISTS (SELECT 1 FROM follows f JOIN profiles p ON p.address = f.follower
                    WHERE f.follower = ${other} AND f.followee = ${me} AND ${visibleOn(db, "p", chainId)}) AS follows_you,
           EXISTS (SELECT 1 FROM blocks WHERE (blocker = ${me} AND blocked = ${other})
                                          OR (blocker = ${other} AND blocked = ${me})) AS blocked`;
  return {
    address: getAddress(other) as Address,
    following: row?.following ?? false,
    followsYou: row?.follows_you ?? false,
    blocked: row?.blocked ?? false,
  };
}

/**
 * Follow `target`. Idempotent. The per-follower advisory lock makes the cap exact under concurrent follows (a count
 * then insert would otherwise let parallel requests pass FOLLOWING_MAX together).
 */
export async function follow(db: Db, me: string, target: string): Promise<void> {
  if (me === target) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "you can't follow yourself");
  try {
    await db.begin(async (tx) => {
      await advisoryLock(tx, LOCK_NS.follow, me);
      const [state] = await tx<{ listed: boolean | null; blocked: boolean; following: boolean; count: number }[]>`
        SELECT (SELECT (listed_practice OR listed_mainnet) AND NOT hidden FROM profiles WHERE address = ${target}) AS listed,
               EXISTS (SELECT 1 FROM blocks WHERE (blocker = ${me} AND blocked = ${target})
                                              OR (blocker = ${target} AND blocked = ${me})) AS blocked,
               EXISTS (SELECT 1 FROM follows WHERE follower = ${me} AND followee = ${target}) AS following,
               (SELECT count(*)::int FROM follows WHERE follower = ${me}) AS count`;
      if (!state?.listed) throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no public profile for this address");
      if (state.blocked)
        throw new HttpError(HTTP_STATUS.forbidden, "BLOCKED", "a block is in place between these accounts");
      if (state.following) return;
      if (state.count >= FOLLOWING_MAX) {
        throw new HttpError(HTTP_STATUS.conflict, "FOLLOW_LIMIT", `you can follow up to ${FOLLOWING_MAX} accounts`);
      }
      await tx`INSERT INTO follows (follower, followee) VALUES (${me}, ${target}) ON CONFLICT DO NOTHING`;
    });
  } catch (error) {
    rethrowDeadlock(error);
    throw error;
  }
}

export async function unfollow(db: Db, me: string, target: string): Promise<void> {
  await db`DELETE FROM follows WHERE follower = ${me} AND followee = ${target}`;
}

/** Whether `address` is listed on `chainId` (lists of a hidden account are as absent as the account). */
export async function isListedOn(db: Db, chainId: ChainId, address: string): Promise<boolean> {
  const [row] = await db<{ ok: boolean }[]>`
    SELECT ${db(listedColumn(chainId))} AND NOT hidden AS ok FROM profiles WHERE address = ${address}`;
  return row?.ok ?? false;
}

/** Counts for the owner, including when their own profile is private on this network. */
export async function ownFollowCounts(db: Db, chainId: ChainId, address: string) {
  const [row] = await db<{ followers: number; following: number }[]>`
    SELECT
      (SELECT count(*)::int FROM follows f JOIN profiles p ON p.address = f.follower
        WHERE f.followee = ${address} AND ${visibleOn(db, "p", chainId)}) AS followers,
      (SELECT count(*)::int FROM follows f JOIN profiles p ON p.address = f.followee
        WHERE f.follower = ${address} AND ${visibleOn(db, "p", chainId)}) AS following`;
  return row ?? { followers: 0, following: 0 };
}

/**
 * One page of `address`'s followers (`direction: "followers"`) or followees, newest first, keyset on `follows.id`.
 * Only accounts listed on `chainId` appear.
 */
export async function followPage(
  db: Db,
  chainId: ChainId,
  address: string,
  direction: "followers" | "following",
  cursor: string | undefined,
  limit: number = FOLLOW_PAGE_DEFAULT,
): Promise<FollowPage> {
  const [self, other] = direction === "followers" ? ["followee", "follower"] : ["follower", "followee"];
  const after = cursor === undefined ? db`` : db`AND f.id < ${BigInt(cursor)}`;
  const rows = await db<
    {
      id: bigint;
      created_at: Date;
      address: string;
      handle: string | null;
      display_name: string | null;
      avatar: string | null;
    }[]
  >`
    SELECT f.id, f.created_at, p.address, p.handle, p.display_name, p.avatar
      FROM follows f JOIN profiles p ON p.address = f.${db(other as string)}
     WHERE f.${db(self as string)} = ${address} AND ${visibleOn(db, "p", chainId)} ${after}
     ORDER BY f.id DESC
     LIMIT ${limit + 1}`;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      address: getAddress(r.address) as Address,
      handle: r.handle,
      displayName: r.display_name,
      avatar: r.avatar,
      followedAt: r.created_at.toISOString(),
    })),
    nextCursor: rows.length > limit && last ? last.id.toString() : null,
  };
}
