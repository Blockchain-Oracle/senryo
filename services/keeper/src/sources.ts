import { type Address, getAddress, type Hex, isAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { createIndexerClient, type IndexerClient, IndexerError } from "@senryo/indexer-client";
import { type Db, type Logger, MS_PER_SECOND } from "@senryo/service-common";
import { INDEXER_TIMEOUT_MS, MAX_SCAN_PAGES, SCAN_LIMIT } from "./constants.ts";
import {
  OpenPositionStartsDocument,
  OpenPositionUsersDocument,
  PendingInboxesDocument,
  PlacedTriggersDocument,
} from "./indexer-documents.ts";

/** One open position per user per market on our engine (one net position, `PerpModule`). */
const positionKey = (user: string, market: string) => `${user.toLowerCase()}:${market}`;

/**
 * Where the keeper learns which accounts / trigger orders to watch. The indexer (S4, Envio) is the real source —
 * `User` entities with open positions and PLACED `Trigger` entities (`IndexerSource`) — and
 * is combined with the ledger (users the api relayed claims for, card-hold accounts) and an env watch list. Card
 * authorisation never reads the indexer; the keeper only uses it to find candidates and re-checks onchain.
 */
export interface KeeperSource {
  /** Accounts that may hold positions (liquidation / health scan). */
  accounts(): Promise<Address[]>;
  /** Open trigger order ids (TP/SL). */
  triggerOrders(): Promise<Hex[]>;
  /** Deployed deposit inboxes with arrivals since their last sweep (S8.24). */
  pendingInboxes(): Promise<InboxCandidate[]>;
}

export interface InboxCandidate {
  user: Address;
  inbox: Address;
}

function uniqueAddresses(values: Iterable<string>): Address[] {
  const seen = new Map<string, Address>();
  for (const value of values) {
    if (isAddress(value, { strict: false })) seen.set(value.toLowerCase(), getAddress(value));
  }
  return [...seen.values()];
}

export class LedgerSource implements KeeperSource {
  constructor(
    private readonly db: Db,
    private readonly chainId: ChainId,
    private readonly watch: readonly string[],
  ) {}

  async accounts(): Promise<Address[]> {
    const rows = await this.db<{ user_address: string }[]>`
      SELECT DISTINCT user_address FROM starter_claims WHERE chain_id = ${this.chainId}
      UNION SELECT DISTINCT account AS user_address FROM holds WHERE chain_id = ${this.chainId}`;
    return uniqueAddresses([...this.watch, ...rows.map((r) => r.user_address)]);
  }

  async triggerOrders(): Promise<Hex[]> {
    return [];
  }

  async pendingInboxes(): Promise<InboxCandidate[]> {
    return [];
  }
}

/**
 * Envio-backed source (S4, `@senryo/indexer-client`): users with open positions and PLACED triggers on this chain,
 * merged with the ledger/watch list. Indexer failures fall back to the ledger source — a keeper never stops scanning
 * because the (display-only) indexer is down.
 */
export class IndexerSource implements KeeperSource {
  private readonly client: IndexerClient;

  constructor(
    url: string,
    private readonly chainId: ChainId,
    private readonly fallback: KeeperSource,
    private readonly log: Logger,
  ) {
    this.client = createIndexerClient({ url, timeoutMs: INDEXER_TIMEOUT_MS });
  }

  /** Every page, not just the first (S8.5b K2/K3): an idle account or an old order must never fall out of the scan. */
  private async all<T>(page: (offset: number) => Promise<T[]>): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < MAX_SCAN_PAGES; i += 1) {
      const rows = await page(i * SCAN_LIMIT);
      out.push(...rows);
      if (rows.length < SCAN_LIMIT) return out;
    }
    this.log.warn({ rows: out.length }, "scan hit MAX_SCAN_PAGES; raise it");
    return out;
  }

  async accounts(): Promise<Address[]> {
    const fromLedger = await this.fallback.accounts();
    try {
      const users = await this.all((offset) =>
        this.client.request(OpenPositionUsersDocument, { chainId: this.chainId, limit: SCAN_LIMIT, offset }),
      );
      return uniqueAddresses([...users, ...fromLedger]);
    } catch (error) {
      this.log.warn({ err: describeIndexerError(error) }, "indexer accounts unavailable; ledger only");
      return fromLedger;
    }
  }

  async triggerOrders(): Promise<Hex[]> {
    try {
      const nowSec = Math.floor(Date.now() / MS_PER_SECOND);
      const [triggers, positions] = await Promise.all([
        this.all((offset) =>
          this.client.request(PlacedTriggersDocument, { chainId: this.chainId, limit: SCAN_LIMIT, offset }),
        ),
        this.all((offset) =>
          this.client.request(OpenPositionStartsDocument, { chainId: this.chainId, limit: SCAN_LIMIT, offset }),
        ),
      ]);
      const openedAt = new Map(positions.map((p) => [positionKey(p.user_id, p.market_id), p.openedAt]));
      // A trigger fires only for the position it was placed for (flow book C6): none open, or one opened after the
      // trigger was placed, means it is a leftover of a closed or liquidated position.
      const live = triggers.filter((t) => {
        const since = openedAt.get(positionKey(t.user_id, t.market_id));
        return t.expiry > nowSec && since !== undefined && t.placedAt >= since;
      });
      const skipped = triggers.length - live.length;
      if (skipped > 0) this.log.info({ skipped }, "triggers skipped: expired or not for the open position");
      return live.map((t) => t.id as Hex);
    } catch (error) {
      this.log.warn({ err: describeIndexerError(error) }, "indexer triggers unavailable");
      return [];
    }
  }

  async pendingInboxes(): Promise<InboxCandidate[]> {
    try {
      const rows = await this.all((offset) =>
        this.client.request(PendingInboxesDocument, { chainId: this.chainId, limit: SCAN_LIMIT, offset }),
      );
      return rows.flatMap((r) =>
        isAddress(r.user, { strict: false }) && isAddress(r.inbox, { strict: false })
          ? [{ user: getAddress(r.user), inbox: getAddress(r.inbox) }]
          : [],
      );
    } catch (error) {
      this.log.warn({ err: describeIndexerError(error) }, "indexer inboxes unavailable; watches only");
      return [];
    }
  }
}

function describeIndexerError(error: unknown): string {
  return error instanceof IndexerError ? `${error.kind}: ${error.message}` : String(error);
}
