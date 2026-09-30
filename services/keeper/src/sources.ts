import { type Address, getAddress, type Hex, isAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { createIndexerClient, type IndexerClient, IndexerError } from "@senryo/indexer-client";
import { type Db, type Logger, MS_PER_SECOND } from "@senryo/service-common";
import { INDEXER_TIMEOUT_MS, SCAN_LIMIT } from "./constants.ts";
import { OpenPositionUsersDocument, PlacedTriggersDocument } from "./indexer-documents.ts";

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

  async accounts(): Promise<Address[]> {
    const fromLedger = await this.fallback.accounts();
    try {
      const users = await this.client.request(OpenPositionUsersDocument, { chainId: this.chainId, limit: SCAN_LIMIT });
      return uniqueAddresses([...users, ...fromLedger]);
    } catch (error) {
      this.log.warn({ err: describeIndexerError(error) }, "indexer accounts unavailable; ledger only");
      return fromLedger;
    }
  }

  async triggerOrders(): Promise<Hex[]> {
    try {
      const nowSec = Math.floor(Date.now() / MS_PER_SECOND);
      const triggers = await this.client.request(PlacedTriggersDocument, { chainId: this.chainId, limit: SCAN_LIMIT });
      return triggers.filter((t) => t.expiry > nowSec).map((t) => t.id as Hex);
    } catch (error) {
      this.log.warn({ err: describeIndexerError(error) }, "indexer triggers unavailable");
      return [];
    }
  }
}

function describeIndexerError(error: unknown): string {
  return error instanceof IndexerError ? `${error.kind}: ${error.message}` : String(error);
}
