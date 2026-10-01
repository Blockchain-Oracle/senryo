import { MARKET_HOLDERS_MAX, type MarketHolder, type MarketHolders } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { notional, pnl } from "@senryo/core";
import { type OpenPosition, ourMarketId } from "@senryo/indexer-client";
import { type Db, HTTP_STATUS, HttpError, MS_PER_SECOND } from "@senryo/service-common";
import { HOLDERS_CACHE_MS } from "./constants.ts";
import type { SocialIndexer } from "./indexer-source.ts";
import { viewerAccountFilter } from "./posts.ts";
import { sharingOn } from "./shared.ts";

/**
 * Market Holders (FT098): the open positions in one engine market of accounts visible on that network AND sharing its
 * trades, largest first by notional at the accepted oracle price. The indexer read (positions of the accounts sharing
 * when it ran) and the price are cached per (network, market) for HOLDERS_CACHE_MS, failures included, so a busy
 * market page never hammers either. Visibility is still decided on every request, as the feed does: an account that
 * stops sharing, unlists or is moderation-hidden drops out at once; with a session, blocks either way and mutes too.
 */

/** An engine market's accepted oracle price (`SessionOracle.peek` `price18`, as `/v1/markets` reads it). */
export interface Mark {
  price18: bigint;
  /** Unix seconds. */
  updatedAt: number;
}

export type MarkReader = (chainId: ChainId, marketId: number) => Promise<Mark>;

interface Snapshot {
  positions: OpenPosition[];
  mark: Mark;
}

interface IdentityRow {
  address: string;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
}

export interface HoldersDeps {
  db: Db;
  indexer: SocialIndexer;
  marks: MarkReader;
  /** Clock override (ms) for the social check. */
  nowMs?: () => number;
}

const RETRY_AFTER_SEC = Math.ceil(HOLDERS_CACHE_MS / MS_PER_SECOND);

/** Any failure that isn't already an answer (unlisted chain, not deployed) is "upstream unavailable". */
const upstream = (what: string) => (error: unknown) => {
  if (error instanceof HttpError) throw error;
  throw new HttpError(HTTP_STATUS.unavailable, "UPSTREAM_UNAVAILABLE", `${what} unavailable`, RETRY_AFTER_SEC);
};

function holderOf(p: OpenPosition, who: IdentityRow, mark18: bigint): MarketHolder {
  const isLong = p.side === "LONG";
  return {
    address: who.address as MarketHolder["address"],
    handle: who.handle,
    displayName: who.display_name,
    avatar: who.avatar,
    isLong,
    size18: p.size,
    entry18: p.entryPrice,
    notionalUsd6: notional(p.size, mark18),
    upnlUsd6: pnl(isLong, p.size, p.entryPrice, mark18),
    openedAt: p.openedAt,
  };
}

/** Largest notional first; equal notionals in position-id order, so the list never reshuffles between reads. */
function byNotional(a: { row: MarketHolder; id: string }, b: { row: MarketHolder; id: string }): number {
  if (a.row.notionalUsd6 !== b.row.notionalUsd6) return a.row.notionalUsd6 > b.row.notionalUsd6 ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export class HoldersService {
  private readonly cache = new Map<string, { at: number; read: Promise<Snapshot> }>();

  constructor(private readonly deps: HoldersDeps) {}

  /** `viewer` (lower-case) leaves out blocks and mutes; `friends` keeps only accounts it follows (needs a viewer). */
  async page(chainId: ChainId, marketId: number, viewer: string | null, friends: boolean): Promise<MarketHolders> {
    const { db } = this.deps;
    if (friends && viewer === null) {
      throw new HttpError(HTTP_STATUS.unauthorized, "UNAUTHORIZED", "sign in to see the people you follow");
    }
    const { positions, mark } = await this.snapshot(chainId, marketId);
    const owners = [...new Set(positions.map((p) => p.user_id.toLowerCase()))];
    const following = friends ? db`AND p.address IN (SELECT followee FROM follows WHERE follower = ${viewer})` : db``;
    const shown =
      owners.length === 0
        ? []
        : await db<IdentityRow[]>`
            SELECT p.address, p.handle, p.display_name, p.avatar FROM profiles p
             WHERE p.address IN ${db(owners)} AND ${sharingOn(db, "p", chainId)}
                   ${following} ${viewerAccountFilter(db, viewer, "p", "address")}`;
    const who = new Map(shown.map((r) => [r.address, r]));
    const ranked = positions
      .flatMap((p) => {
        const row = who.get(p.user_id.toLowerCase());
        return row ? [{ row: holderOf(p, row, mark.price18), id: p.id }] : [];
      })
      .sort(byNotional);
    return {
      chainId,
      marketId,
      mark18: mark.price18,
      markUpdatedAt: mark.updatedAt,
      holders: ranked.slice(0, MARKET_HOLDERS_MAX).map((r) => r.row),
      more: Math.max(0, ranked.length - MARKET_HOLDERS_MAX),
    };
  }

  /** One read per (network, market) per HOLDERS_CACHE_MS; concurrent requests share the read in flight. */
  private snapshot(chainId: ChainId, marketId: number): Promise<Snapshot> {
    const key = `${chainId}:${marketId}`;
    const now = this.deps.nowMs?.() ?? Date.now();
    const held = this.cache.get(key);
    if (held && now - held.at < HOLDERS_CACHE_MS) return held.read;
    const read = this.read(chainId, marketId);
    // A failure stays cached too (503 until it expires); this keeps it from surfacing as an unhandled rejection.
    read.catch(() => undefined);
    this.cache.set(key, { at: now, read });
    return read;
  }

  private async read(chainId: ChainId, marketId: number): Promise<Snapshot> {
    const { db, indexer, marks } = this.deps;
    const sharers = await db<{ address: string }[]>`
      SELECT p.address FROM profiles p WHERE ${sharingOn(db, "p", chainId)}`;
    const users = sharers.map((s) => s.address);
    const [positions, mark] = await Promise.all([
      // Nobody shares on this network: no holders to show, whatever the indexer holds.
      users.length === 0
        ? []
        : indexer.marketHolders(chainId, ourMarketId(marketId), users).catch(upstream("market holders")),
      marks(chainId, marketId).catch(upstream("oracle price")),
    ]);
    if (mark.price18 === 0n) {
      throw new HttpError(HTTP_STATUS.unavailable, "UPSTREAM_UNAVAILABLE", "no accepted price yet", RETRY_AFTER_SEC);
    }
    return { positions, mark };
  }
}
