import {
  ActivityDocument,
  activityVars,
  createIndexerClient,
  type IndexerClient,
  IndexerError,
  MetaDocument,
  PortfolioDocument,
} from "@senryo/indexer-client";
import type { Logger } from "@senryo/service-common";
import { INDEXER_POLL_MS, RECENT_ACTIVITY, UPSTREAM_TIMEOUT_MS } from "./constants.ts";

/**
 * Indexer bridge (specs/services.md §api) over `@senryo/indexer-client` (S4): polls `_meta` every 500 ms for each
 * chain's `progressBlock` (status page, freshness of history) and answers per-account history for
 * `/v1/account/:address`. Display only (D-014): money paths — the card responder above all — never read it; an
 * unavailable indexer yields `null`, never an empty history.
 */
export interface AccountHistory {
  indexedBlock: bigint;
  stats: {
    deposited: bigint;
    withdrawn: bigint;
    realizedPnl: bigint;
    feesPaid: bigint;
    fundingPaid: bigint;
    volume: bigint;
    cardSpent: bigint;
    tradeCount: number;
    liquidationCount: number;
    openPositions: number;
  } | null;
  recent: Array<{
    id: string;
    kind: string;
    timestamp: number;
    block: number;
    txHash: string;
    amount: bigint | null;
    symbol: string | null;
  }>;
}

export interface IndexerBridge {
  /** Last block the indexer processed for `chainId`, or null when unknown / not configured. */
  progressBlock(chainId: number): bigint | null;
  history(chainId: number, address: string): Promise<AccountHistory | null>;
  start(): void;
  stop(): void;
}

export class NullIndexerBridge implements IndexerBridge {
  progressBlock(): bigint | null {
    return null;
  }
  async history(): Promise<AccountHistory | null> {
    return null;
  }
  start(): void {}
  stop(): void {}
}

export class EnvioIndexerBridge implements IndexerBridge {
  private readonly client: IndexerClient;
  private readonly progress = new Map<number, bigint>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;

  constructor(
    url: string,
    private readonly log: Logger,
  ) {
    this.client = createIndexerClient({ url, timeoutMs: UPSTREAM_TIMEOUT_MS });
  }

  progressBlock(chainId: number): bigint | null {
    return this.progress.get(chainId) ?? null;
  }

  start(): void {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), INDEXER_POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async history(chainId: number, address: string): Promise<AccountHistory | null> {
    const account = { chainId, user: address.toLowerCase() };
    try {
      const [portfolio, activity] = await Promise.all([
        this.client.request(PortfolioDocument, account),
        this.client.request(ActivityDocument, activityVars(account, { limit: RECENT_ACTIVITY })),
      ]);
      const indexedBlock = portfolio.meta ? BigInt(portfolio.meta.progressBlock) : this.progressBlock(chainId);
      if (indexedBlock === null) return null;
      const u = portfolio.user;
      return {
        indexedBlock,
        stats: u && {
          deposited: u.deposited,
          withdrawn: u.withdrawn,
          realizedPnl: u.realizedPnl,
          feesPaid: u.feesPaid,
          fundingPaid: u.fundingPaid,
          volume: u.volume,
          cardSpent: u.cardSpent,
          tradeCount: u.tradeCount,
          liquidationCount: u.liquidationCount,
          openPositions: u.openPositions,
        },
        recent: activity.map((a) => ({
          id: a.id,
          kind: a.kind,
          timestamp: a.timestamp,
          block: a.block,
          txHash: a.txHash,
          amount: a.amount ?? null,
          symbol: a.symbol ?? null,
        })),
      };
    } catch (error) {
      this.log.warn(
        { err: error instanceof IndexerError ? `${error.kind}: ${error.message}` : String(error) },
        "history unavailable",
      );
      return null;
    }
  }

  private async poll(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const meta of await this.client.request(MetaDocument, {})) {
        this.progress.set(meta.chainId, BigInt(meta.progressBlock));
      }
    } catch (error) {
      this.log.debug({ err: String(error) }, "indexer _meta poll failed");
    } finally {
      this.busy = false;
    }
  }
}
