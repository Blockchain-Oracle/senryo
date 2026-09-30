import type { Hex } from "viem";
import type { ReadClient } from "./clients.ts";
import { FINALIZED_HASH_WINDOW, HEAD_FEED_STALE_MS, POLL_INTERVAL_MS } from "./constants.ts";

/**
 * Commit-state heads from Monad's `monadNewHeads` WS feed (context/02-monad/realtime-data-and-indexing.md):
 * each update carries `number`, `hash` and `commitState` ∈ Proposed | Voted | Finalized | Verified. Probed live on
 * testnet 30 Sep: Finalized arrives ≈ 0.5–0.6 s after Proposed. Without a feed (or when it goes quiet) the tracker
 * polls `getBlock({ blockTag: "safe" | "finalized" })`. It remembers recent finalized hashes so a receipt can be
 * checked against the canonical block (a proposal can be abandoned; no event is sent for that).
 */

export type CommitLevel = "proposed" | "voted" | "finalized";

export interface Heads {
  proposed: bigint;
  voted: bigint;
  finalized: bigint;
}

interface MonadHead {
  number?: Hex;
  hash?: Hex;
  commitState?: "Proposed" | "Voted" | "Finalized" | "Verified";
}

type Waiter = { level: CommitLevel; target: bigint; resolve: () => void };

export class HeadTracker {
  private heads: Heads = { proposed: 0n, voted: 0n, finalized: 0n };
  private readonly finalizedHashes = new Map<bigint, Hex>();
  private waiters: Waiter[] = [];
  private lastFeedAt = 0;
  private unsubscribe: (() => Promise<unknown>) | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling = false;

  constructor(
    private readonly read: ReadClient,
    private readonly ws?: ReadClient,
  ) {}

  current(): Heads {
    return { ...this.heads };
  }

  /** Hash of a recently finalized height (undefined if unknown or outside the window). */
  finalizedHash(blockNumber: bigint): Hex | undefined {
    return this.finalizedHashes.get(blockNumber);
  }

  async start(): Promise<void> {
    await this.poll();
    await this.subscribe();
    this.timer = setInterval(() => {
      if (Date.now() - this.lastFeedAt > HEAD_FEED_STALE_MS) void this.poll();
    }, POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.unsubscribe?.().catch(() => undefined);
    this.unsubscribe = undefined;
  }

  /** Resolves once `level` has reached `blockNumber` (or immediately if it already has). */
  waitFor(level: CommitLevel, blockNumber: bigint): Promise<void> {
    if (this.heads[level] >= blockNumber) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push({ level, target: blockNumber, resolve }));
  }

  private async subscribe(): Promise<void> {
    const transport = this.ws?.transport as
      | {
          subscribe?: (args: {
            params: [string];
            onData: (data: { result?: MonadHead }) => void;
            onError?: (error: unknown) => void;
          }) => Promise<{ unsubscribe: () => Promise<unknown> }>;
        }
      | undefined;
    if (!transport?.subscribe) return;
    try {
      const sub = await transport.subscribe({
        params: ["monadNewHeads"],
        onData: (data) => this.onHead(data.result),
        onError: () => {
          this.lastFeedAt = 0;
        },
      });
      this.unsubscribe = sub.unsubscribe;
    } catch {
      this.lastFeedAt = 0;
    }
  }

  private onHead(head: MonadHead | undefined): void {
    if (!head?.number || !head.commitState) return;
    this.lastFeedAt = Date.now();
    const number = BigInt(head.number);
    if (head.commitState === "Proposed") this.advance("proposed", number);
    if (head.commitState === "Voted") this.advance("voted", number);
    if (head.commitState === "Finalized") {
      if (head.hash) this.rememberFinalized(number, head.hash);
      this.advance("finalized", number);
    }
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const [safe, finalized] = await Promise.all([
        this.read.getBlock({ blockTag: "safe" }),
        this.read.getBlock({ blockTag: "finalized" }),
      ]);
      this.rememberFinalized(finalized.number, finalized.hash);
      this.advance("finalized", finalized.number);
      this.advance("voted", safe.number);
      this.advance("proposed", safe.number);
    } catch {
      // Transient RPC failure: the next tick retries; waiters keep waiting (callers own their timeouts).
    } finally {
      this.polling = false;
    }
  }

  private rememberFinalized(number: bigint, hash: Hex): void {
    this.finalizedHashes.set(number, hash);
    const floor = number - BigInt(FINALIZED_HASH_WINDOW);
    for (const height of this.finalizedHashes.keys()) {
      if (height < floor) this.finalizedHashes.delete(height);
    }
  }

  private advance(level: CommitLevel, number: bigint): void {
    if (number > this.heads[level]) this.heads[level] = number;
    // Finalized implies voted implies proposed.
    if (level === "finalized" && number > this.heads.voted) this.heads.voted = number;
    if (level !== "proposed" && number > this.heads.proposed) this.heads.proposed = number;
    const ready = this.waiters.filter((w) => this.heads[w.level] >= w.target);
    if (ready.length === 0) return;
    this.waiters = this.waiters.filter((w) => this.heads[w.level] < w.target);
    for (const w of ready) w.resolve();
  }
}
