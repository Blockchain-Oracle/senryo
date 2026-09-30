import type { Logger } from "@senryo/service-common";
import { INDEXER_POLL_MS, UPSTREAM_TIMEOUT_MS } from "./constants.ts";

/**
 * Indexer bridge (specs/services.md §api): poll Envio's Hasura every 500 ms keyed by `_meta.progressBlock` and fan
 * out history deltas. S4 builds the indexer and `@senryo/indexer-client` in parallel, so this is a small interface
 * with a best-effort Hasura poller; the history queries plug in when S4 merges (see the S3 handoff).
 */
export interface IndexerBridge {
  /** Last block the indexer processed for `chainId`, or null when unknown / not configured. */
  progressBlock(chainId: number): bigint | null;
  start(): void;
  stop(): void;
}

export class NullIndexerBridge implements IndexerBridge {
  progressBlock(): bigint | null {
    return null;
  }
  start(): void {}
  stop(): void {}
}

/** Envio HyperIndex V3 `_meta` (per chain). Query shape to confirm against S4's schema at merge. */
const META_QUERY = "{ _meta { chainId progressBlock } }";

export class HasuraIndexerBridge implements IndexerBridge {
  private readonly progress = new Map<number, bigint>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;

  constructor(
    private readonly url: string,
    private readonly log: Logger,
  ) {}

  progressBlock(chainId: number): bigint | null {
    return this.progress.get(chainId) ?? null;
  }

  start(): void {
    this.timer = setInterval(() => void this.poll(), INDEXER_POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: META_QUERY }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const json = (await res.json()) as {
        data?: { _meta?: Array<{ chainId: number; progressBlock: number | string }> };
      };
      for (const meta of json.data?._meta ?? []) this.progress.set(meta.chainId, BigInt(meta.progressBlock));
    } catch (error) {
      this.log.debug({ err: String(error) }, "indexer poll failed");
    } finally {
      this.busy = false;
    }
  }
}
