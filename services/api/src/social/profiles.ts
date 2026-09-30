import {
  HANDLE_TOMBSTONE_DAYS,
  type HandleAvailability,
  handleSyntaxIssue,
  normalizeHandle,
  PROFILE_VISIBILITY_DEFAULTS,
  type ProfileUpdate,
  type PublicProfile,
} from "@senryo/api-client";
import { type Address, getAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { type Db, HTTP_STATUS, HttpError, MS_PER_SECOND, SECONDS_PER_DAY, type Tx } from "@senryo/service-common";
import { HANDLE_CHANGES_PER_WINDOW, HANDLE_UNIQUE_INDEX, LOCK_NS, PG_UNIQUE_VIOLATION } from "./constants.ts";
import { nameIsReserved, screenHandle, textHasBlockedWord } from "./moderation.ts";
import {
  advisoryLock,
  listedColumn,
  type ProfileRow,
  pgErrorOf,
  publicTradesColumn,
  rethrowDeadlock,
} from "./shared.ts";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Precise state of a handle for the availability endpoint (no session: a `held` handle reads as held to everyone). */
export async function handleAvailability(db: Db, raw: string): Promise<HandleAvailability> {
  const handle = normalizeHandle(raw);
  const base = { handle, reason: null, heldUntil: null };
  const screen = screenHandle(handle);
  if (screen.state === "invalid") return { ...base, state: "invalid", reason: screen.reason };
  if (screen.state === "reserved") return { ...base, state: "reserved" };
  const [row] = await db<{ taken: boolean; held_until: Date | null }[]>`
    SELECT EXISTS (SELECT 1 FROM profiles WHERE lower(handle) = ${handle}) AS taken,
           (SELECT held_until FROM handle_tombstones WHERE handle = ${handle} AND held_until > now()) AS held_until`;
  if (row?.taken) return { ...base, state: "taken" };
  if (row?.held_until) return { ...base, state: "held", heldUntil: row.held_until.toISOString() };
  return { ...base, state: "available" };
}

/** `undefined` keeps, `null` or blank clears, text is trimmed. */
function cleanText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function blocked(field: string): HttpError {
  return new HttpError(HTTP_STATUS.badRequest, "CONTENT_BLOCKED", `${field} is not allowed`, undefined, { field });
}

/** Validate what can be checked before touching the database (handle lists, content filter). */
function screenUpdate(update: ProfileUpdate) {
  const rawHandle = cleanText(update.handle);
  const handle = typeof rawHandle === "string" ? normalizeHandle(rawHandle) : rawHandle;
  if (typeof handle === "string") {
    const screen = screenHandle(handle);
    if (screen.state === "invalid") {
      throw new HttpError(HTTP_STATUS.badRequest, "HANDLE_INVALID", `handle is invalid (${screen.reason})`, undefined, {
        reason: screen.reason,
      });
    }
    if (screen.state === "reserved") throw new HttpError(HTTP_STATUS.conflict, "HANDLE_RESERVED", "handle is reserved");
  }
  const displayName = cleanText(update.displayName);
  if (displayName && (textHasBlockedWord(displayName) || nameIsReserved(displayName))) throw blocked("displayName");
  const bio = cleanText(update.bio);
  if (bio && textHasBlockedWord(bio)) throw blocked("bio");
  return { handle, displayName, bio };
}

/** At most HANDLE_CHANGES_PER_WINDOW released handles held at once per account (no squatting by renaming). */
async function checkChangeBudget(tx: Tx, address: string): Promise<void> {
  const [recent] = await tx<{ n: number; oldest: Date | null }[]>`
    SELECT count(*)::int AS n, min(released_at) AS oldest FROM handle_tombstones
     WHERE address = ${address} AND released_at > now() - make_interval(days => ${HANDLE_TOMBSTONE_DAYS})`;
  if (!recent || recent.n < HANDLE_CHANGES_PER_WINDOW || !recent.oldest) return;
  const freeAt = recent.oldest.getTime() + HANDLE_TOMBSTONE_DAYS * SECONDS_PER_DAY * MS_PER_SECOND;
  const wait = Math.max(Math.ceil((freeAt - Date.now()) / MS_PER_SECOND), 0);
  throw new HttpError(HTTP_STATUS.tooMany, "RATE_LIMITED", "too many handle changes; try later", wait);
}

/** Claim `next` for `address`: refuse another owner's tombstone, reclaim our own, and tombstone `previous`. */
async function moveHandle(tx: Tx, address: string, previous: string | null, next: string | null): Promise<void> {
  const touched = [previous, next].filter((h): h is string => h !== null).sort();
  // Sorted per-handle locks: a release and a claim of the same handle serialise, so the tombstone can't be raced.
  for (const handle of touched) await advisoryLock(tx, LOCK_NS.handle, handle);
  if (previous) await checkChangeBudget(tx, address);
  if (next) {
    const [held] = await tx<{ address: string; held_until: Date }[]>`
      SELECT address, held_until FROM handle_tombstones WHERE handle = ${next} AND held_until > now()`;
    if (held && held.address !== address) {
      throw new HttpError(HTTP_STATUS.conflict, "HANDLE_HELD", "handle was released recently", undefined, {
        heldUntil: held.held_until.toISOString(),
      });
    }
    await tx`DELETE FROM handle_tombstones WHERE handle = ${next}`;
  }
  if (previous) {
    await tx`
      INSERT INTO handle_tombstones (handle, address, held_until)
      VALUES (${previous}, ${address}, now() + make_interval(days => ${HANDLE_TOMBSTONE_DAYS}))
      ON CONFLICT (handle) DO UPDATE SET address = EXCLUDED.address, released_at = now(), held_until = EXCLUDED.held_until`;
  }
}

/**
 * Upsert the session account's profile. The unique index decides a handle race (exactly one claimer wins; the other
 * gets HANDLE_TAKEN); per-account and per-handle advisory locks keep the tombstone and the change budget exact.
 */
export async function saveProfile(db: Db, address: string, update: ProfileUpdate): Promise<ProfileRow> {
  const clean = screenUpdate(update);
  try {
    return await db.begin(async (tx) => {
      await advisoryLock(tx, LOCK_NS.profile, address);
      const [current] = await tx<ProfileRow[]>`SELECT * FROM profiles WHERE address = ${address} FOR UPDATE`;
      const previous = current?.handle ?? null;
      const handle = clean.handle === undefined ? previous : clean.handle;
      const changing = handle !== previous;
      if (changing) await moveHandle(tx, address, previous, handle);
      const listedPractice =
        update.listedPractice ?? current?.listed_practice ?? PROFILE_VISIBILITY_DEFAULTS.listedPractice;
      const listedMainnet =
        update.listedMainnet ?? current?.listed_mainnet ?? PROFILE_VISIBILITY_DEFAULTS.listedMainnet;
      const row = {
        address,
        handle,
        display_name: clean.displayName === undefined ? (current?.display_name ?? null) : clean.displayName,
        bio: clean.bio === undefined ? (current?.bio ?? null) : clean.bio,
        avatar: update.avatar === undefined ? (current?.avatar ?? null) : update.avatar,
        listed_practice: listedPractice,
        listed_mainnet: listedMainnet,
        // A network's public trades need its listing (also a CHECK in 0005).
        public_trades_practice:
          listedPractice &&
          (update.publicTradesPractice ??
            current?.public_trades_practice ??
            PROFILE_VISIBILITY_DEFAULTS.publicTradesPractice),
        public_trades_mainnet:
          listedMainnet &&
          (update.publicTradesMainnet ??
            current?.public_trades_mainnet ??
            PROFILE_VISIBILITY_DEFAULTS.publicTradesMainnet),
        handle_changed_at: changing ? new Date() : (current?.handle_changed_at ?? null),
      };
      const [saved] = await tx<ProfileRow[]>`
        INSERT INTO profiles ${tx(row)}
        ON CONFLICT (address) DO UPDATE SET handle = EXCLUDED.handle, display_name = EXCLUDED.display_name,
          bio = EXCLUDED.bio, avatar = EXCLUDED.avatar, listed_practice = EXCLUDED.listed_practice,
          listed_mainnet = EXCLUDED.listed_mainnet, public_trades_practice = EXCLUDED.public_trades_practice,
          public_trades_mainnet = EXCLUDED.public_trades_mainnet, handle_changed_at = EXCLUDED.handle_changed_at,
          updated_at = now()
        RETURNING *`;
      if (!saved) throw new HttpError(HTTP_STATUS.internal, "INTERNAL", "profile not stored");
      return saved;
    });
  } catch (error) {
    const pg = pgErrorOf(error);
    if (pg.code === PG_UNIQUE_VIOLATION && pg.constraint === HANDLE_UNIQUE_INDEX) {
      throw new HttpError(HTTP_STATUS.conflict, "HANDLE_TAKEN", "handle is taken");
    }
    rethrowDeadlock(error);
    throw error;
  }
}

export async function readProfile(db: Db, address: string): Promise<ProfileRow | undefined> {
  const [row] = await db<ProfileRow[]>`SELECT * FROM profiles WHERE address = ${address}`;
  return row;
}

/**
 * A profile as the public sees it on `chainId` — or undefined when there is none OR it isn't listed there, so the two
 * are indistinguishable. `@handle` therefore resolves on mainnet only for `listed_mainnet` profiles.
 */
export async function publicProfile(db: Db, chainId: ChainId, lookup: string): Promise<PublicProfile | undefined> {
  const byAddress = ADDRESS_RE.test(lookup);
  const key = byAddress ? lookup.toLowerCase() : normalizeHandle(lookup);
  if (!byAddress && handleSyntaxIssue(key)) return undefined;
  const listed = db(listedColumn(chainId));
  const where = byAddress ? db`p.address = ${key}` : db`lower(p.handle) = ${key}`;
  const [row] = await db<(ProfileRow & { followers: number; following: number })[]>`
    SELECT p.*,
      (SELECT count(*)::int FROM follows f JOIN profiles q ON q.address = f.follower
        WHERE f.followee = p.address AND q.${listed}) AS followers,
      (SELECT count(*)::int FROM follows f JOIN profiles q ON q.address = f.followee
        WHERE f.follower = p.address AND q.${listed}) AS following
      FROM profiles p
     WHERE ${where} AND p.${listed}`;
  if (!row) return undefined;
  return {
    chainId,
    address: getAddress(row.address) as Address,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    avatar: row.avatar,
    publicTrades: row[publicTradesColumn(chainId)],
    followers: row.followers,
    following: row.following,
    createdAt: row.created_at.toISOString(),
  };
}
