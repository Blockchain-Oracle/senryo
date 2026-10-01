import type { ChainId } from "@senryo/config";
import type { FeedFill, FillKey } from "@senryo/indexer-client";
import { type Db, type Logger, MS_PER_SECOND } from "@senryo/service-common";
import {
  FEED_BACKFILL_SEC,
  FEED_FILTER_IN_MAX,
  FEED_PAGE,
  FEED_PAGES_PER_TICK,
  FEED_POLL_MS,
  FEED_SOURCE_FILL,
  POSITION_CHANGE_KINDS,
} from "./constants.ts";
import type { SocialIndexer } from "./indexer-source.ts";
import type { FeedNotifier } from "./runtime.ts";
import { sharingOn, sharingSinceColumn } from "./shared.ts";

/**
 * Feed poller (S12b.4): an api background job that copies indexed fills of accounts sharing that network's trades
 * into `feed_events`. The api database and the indexer are separate, so it reads GraphQL after a per-network cursor
 * (`feed_cursors`, `<block>:<fillId>`) with a `chainId` filter. Only fills by an account that shares trades on that
 * network AND happened after it turned sharing on are written; the cursor advances past everything else. Each page
 * and its cursor commit together, and `(chain_id, source_id)` makes a replay a no-op.
 */

export interface FeedPollerDeps {
  db: Db;
  indexer: SocialIndexer;
  notifier: FeedNotifier;
  log: Logger;
  chainIds: readonly ChainId[];
  nowSec?: () => number;
}

interface Sharer {
  address: string;
  since: Date;
}

const CURSOR_SEPARATOR = ":";

export function encodeCursor(key: FillKey): string {
  return `${key.block}${CURSOR_SEPARATOR}${key.id}`;
}

export function decodeCursor(text: string | undefined): FillKey | null {
  if (!text) return null;
  const at = text.indexOf(CURSOR_SEPARATOR);
  const block = Number(text.slice(0, at));
  return at > 0 && Number.isSafeInteger(block) ? { block, id: text.slice(at + 1) } : null;
}

/** `position` = the fill opened, closed, liquidated or flipped a position; `fill` = it resized one. */
export function feedRowOf(chainId: ChainId, f: FeedFill) {
  const closing = f.kind === "CLOSE" || f.kind === "LIQUIDATE";
  const p = f.position;
  return {
    chain_id: chainId,
    source_id: `${FEED_SOURCE_FILL}:${f.id}`,
    kind: POSITION_CHANGE_KINDS.has(f.kind) ? "position" : "fill",
    actor: f.user_id.toLowerCase(),
    market_id: f.market.id,
    position_id: p.id,
    block: BigInt(f.block),
    occurred_at: new Date(f.timestamp * MS_PER_SECOND),
    payload: {
      venue: f.venue,
      fillKind: f.kind,
      side: f.side,
      symbol: f.market.symbol,
      size: f.size.toString(),
      price: f.price?.toString() ?? null,
      notional: f.notional.toString(),
      fee: f.fee.toString(),
      realizedPnl: f.realizedPnl.toString(),
      funding: f.funding.toString(),
      borrow: f.borrow.toString(),
      txHash: f.txHash,
      block: f.block,
      // Derived from this fill, not the position's later state (a lagging poll must not rewrite history).
      positionStatus: f.kind === "LIQUIDATE" ? "LIQUIDATED" : f.kind === "CLOSE" ? "CLOSED" : "OPEN",
      positionNetPnl: closing ? (p.realizedPnl - p.feesPaid - p.fundingPaid - p.borrowPaid).toString() : null,
    },
  };
}

export class FeedPoller {
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;

  constructor(private readonly deps: FeedPollerDeps) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), FEED_POLL_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  /** A tick still reading when the next fires is skipped, never stacked. */
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const chainId of this.deps.chainIds) {
        try {
          await this.pollChain(chainId);
        } catch (error) {
          this.deps.log.debug({ chainId, err: String(error) }, "feed poll failed; retrying next tick");
        }
      }
    } finally {
      this.busy = false;
    }
  }

  /** One network: drain up to FEED_PAGES_PER_TICK pages after the cursor. Returns rows written. */
  async pollChain(chainId: ChainId): Promise<number> {
    const { db, indexer } = this.deps;
    const sharers = await db<Sharer[]>`
      SELECT p.address, p.${db(sharingSinceColumn(chainId))} AS since FROM profiles p
       WHERE ${sharingOn(db, "p", chainId)} AND p.${db(sharingSinceColumn(chainId))} IS NOT NULL`;
    // Nobody shares: nothing to write, and the cursor may wait — a later sharer's fills start at their own `since`.
    if (sharers.length === 0) return 0;
    // Sharing start in ms: a fill is written only at or after that instant (the read side applies the same test).
    const sinceOf = new Map(sharers.map((s) => [s.address, s.since.getTime()]));
    const nowSec = this.deps.nowSec?.() ?? Math.floor(Date.now() / MS_PER_SECOND);
    const floor = Math.max(nowSec - FEED_BACKFILL_SEC, Math.floor(Math.min(...sinceOf.values()) / MS_PER_SECOND));
    const users = sharers.length <= FEED_FILTER_IN_MAX ? [...sinceOf.keys()] : null;
    const [stored] = await db<{ cursor: string }[]>`
      SELECT cursor FROM feed_cursors WHERE chain_id = ${chainId} AND source = ${FEED_SOURCE_FILL}`;
    let cursor = decodeCursor(stored?.cursor);
    let written = 0;
    let latest = 0n;
    for (let page = 0; page < FEED_PAGES_PER_TICK; page += 1) {
      const fills = await indexer.feedFills(chainId, cursor, users, floor, FEED_PAGE);
      const last = fills.at(-1);
      if (!last) break;
      const rows = fills
        .filter((f) => {
          const since = sinceOf.get(f.user_id.toLowerCase());
          return since !== undefined && f.timestamp * MS_PER_SECOND >= since;
        })
        .map((f) => feedRowOf(chainId, f));
      const next: FillKey = { block: last.block, id: last.id };
      const ids = await db.begin(async (tx) => {
        const inserted =
          rows.length === 0
            ? []
            : await tx<{ id: bigint }[]>`
                INSERT INTO feed_events ${tx(rows.map((r) => ({ ...r, payload: tx.json(r.payload) })))}
                ON CONFLICT (chain_id, source_id) DO NOTHING RETURNING id`;
        await tx`
          INSERT INTO feed_cursors (chain_id, source, cursor) VALUES (${chainId}, ${FEED_SOURCE_FILL}, ${encodeCursor(next)})
          ON CONFLICT (chain_id, source) DO UPDATE SET cursor = EXCLUDED.cursor, updated_at = now()`;
        return inserted.map((r) => r.id);
      });
      written += ids.length;
      for (const id of ids) if (id > latest) latest = id;
      cursor = next;
      if (fills.length < FEED_PAGE) break;
    }
    if (latest > 0n) this.deps.notifier.emit(chainId, latest);
    return written;
  }
}
