import { type Address, getAddress, type Hex, isAddress } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db, Logger } from "@senryo/service-common";

/**
 * Where the keeper learns which accounts / trigger orders to watch. The indexer (S4, Envio) is the real source —
 * `User` entities with open positions and `Trigger` entities — and lands with the S4 merge; until then the keeper
 * uses the ledger (users the api relayed claims for) plus an env watch list. Card authorisation never reads the
 * indexer; the keeper only uses it to find candidates and re-checks everything onchain before sending.
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
 * Indexer-backed source (S4). The query shape follows specs/services.md (entities `User`, `Trigger`); it is a
 * best-effort stub until `@senryo/indexer-client` merges — failures fall back to the ledger source.
 */
export class IndexerSource implements KeeperSource {
  constructor(
    private readonly url: string,
    private readonly chainId: ChainId,
    private readonly fallback: KeeperSource,
    private readonly log: Logger,
  ) {}

  private async query<T>(query: string): Promise<T | undefined> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return undefined;
      const json = (await res.json()) as { data?: T };
      return json.data;
    } catch (error) {
      this.log.debug({ err: String(error) }, "indexer source unavailable");
      return undefined;
    }
  }

  async accounts(): Promise<Address[]> {
    const data = await this.query<{ User?: Array<{ id: string }> }>(
      `{ User(where: { chainId: { _eq: ${this.chainId} }, openPositions: { _gt: 0 } }) { id } }`,
    );
    const fromIndexer = data?.User?.map((u) => u.id.split("-").pop() ?? "") ?? [];
    return uniqueAddresses([...fromIndexer, ...(await this.fallback.accounts())]);
  }

  async triggerOrders(): Promise<Hex[]> {
    const data = await this.query<{ Trigger?: Array<{ orderId: string }> }>(
      `{ Trigger(where: { chainId: { _eq: ${this.chainId} }, status: { _eq: "PLACED" } }) { orderId } }`,
    );
    return (data?.Trigger ?? []).map((t) => t.orderId as Hex);
  }
}
