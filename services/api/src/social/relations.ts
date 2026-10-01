import type { RelationEntry } from "@senryo/api-client";
import { type Address, getAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { type Db, HTTP_STATUS, HttpError } from "@senryo/service-common";
import { BLOCKS_MAX, LOCK_NS, MUTES_MAX, RELATION_PAGE_DEFAULT } from "./constants.ts";
import { advisoryLock, rethrowDeadlock, visibleOn } from "./shared.ts";

/**
 * Blocks and mutes (S12b.6). Account-level, private to the one who set them.
 * A block removes follows both ways in the same transaction, under both accounts' follow locks — the lock `follow()`
 * takes — so a follow racing the block either lands first (and is deleted) or sees the block (and is refused).
 * Locks are taken in sorted order, so two crossing blocks can't deadlock.
 */

function selfCheck(me: string, other: string): void {
  if (me === other) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "that's your own account");
}

export async function block(db: Db, me: string, other: string): Promise<void> {
  selfCheck(me, other);
  try {
    await db.begin(async (tx) => {
      for (const address of [me, other].sort()) await advisoryLock(tx, LOCK_NS.follow, address);
      await advisoryLock(tx, LOCK_NS.relation, me);
      const [held] = await tx<{ n: number; has: boolean }[]>`
        SELECT count(*)::int AS n, bool_or(blocked = ${other}) AS has FROM blocks WHERE blocker = ${me}`;
      if (!held?.has && (held?.n ?? 0) >= BLOCKS_MAX) {
        throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", `you can block up to ${BLOCKS_MAX} accounts`);
      }
      await tx`INSERT INTO blocks (blocker, blocked) VALUES (${me}, ${other}) ON CONFLICT DO NOTHING`;
      await tx`DELETE FROM follows WHERE (follower = ${me} AND followee = ${other})
                                      OR (follower = ${other} AND followee = ${me})`;
    });
  } catch (error) {
    rethrowDeadlock(error);
    throw error;
  }
}

export async function unblock(db: Db, me: string, other: string): Promise<void> {
  await db`DELETE FROM blocks WHERE blocker = ${me} AND blocked = ${other}`;
}

export async function mute(db: Db, me: string, other: string): Promise<void> {
  selfCheck(me, other);
  await db.begin(async (tx) => {
    await advisoryLock(tx, LOCK_NS.relation, me);
    const [held] = await tx<{ n: number; has: boolean }[]>`
      SELECT count(*)::int AS n, bool_or(muted = ${other}) AS has FROM mutes WHERE muter = ${me}`;
    if (!held?.has && (held?.n ?? 0) >= MUTES_MAX) {
      throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", `you can mute up to ${MUTES_MAX} accounts`);
    }
    await tx`INSERT INTO mutes (muter, muted) VALUES (${me}, ${other}) ON CONFLICT DO NOTHING`;
  });
}

export async function unmute(db: Db, me: string, other: string): Promise<void> {
  await db`DELETE FROM mutes WHERE muter = ${me} AND muted = ${other}`;
}

export async function isBlocked(db: Db, me: string, other: string): Promise<boolean> {
  const [row] = await db<{ on: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM blocks WHERE blocker = ${me} AND blocked = ${other}) AS on`;
  return row?.on ?? false;
}

export async function isMuted(db: Db, me: string, other: string): Promise<boolean> {
  const [row] = await db<{ on: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM mutes WHERE muter = ${me} AND muted = ${other}) AS on`;
  return row?.on ?? false;
}

/**
 * My blocks or mutes, newest first. Handle, name and avatar appear only while the account is visible on the
 * session's network (a block list must not become a way to read an unlisted account's mainnet handle).
 */
export async function relationList(
  db: Db,
  kind: "blocks" | "mutes",
  chainId: ChainId,
  me: string,
  limit: number = RELATION_PAGE_DEFAULT,
): Promise<RelationEntry[]> {
  const [table, owner, target] = kind === "blocks" ? ["blocks", "blocker", "blocked"] : ["mutes", "muter", "muted"];
  const rows = await db<
    {
      address: string;
      created_at: Date;
      visible: boolean | null;
      handle: string | null;
      display_name: string | null;
      avatar: string | null;
    }[]
  >`
    SELECT r.${db(target)} AS address, r.created_at, ${visibleOn(db, "p", chainId)} AS visible,
           p.handle, p.display_name, p.avatar
      FROM ${db(table)} r LEFT JOIN profiles p ON p.address = r.${db(target)}
     WHERE r.${db(owner)} = ${me}
     ORDER BY r.created_at DESC
     LIMIT ${limit}`;
  return rows.map((r) => ({
    address: getAddress(r.address) as Address,
    handle: r.visible ? r.handle : null,
    displayName: r.visible ? r.display_name : null,
    avatar: r.visible ? r.avatar : null,
    since: r.created_at.toISOString(),
  }));
}
