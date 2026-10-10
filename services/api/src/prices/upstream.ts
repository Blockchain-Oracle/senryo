import { MS_PER_SECOND } from "@senryo/service-common";

/**
 * Rate, rest and outcome for calls to a price upstream (04-pricing R2). Each REST source keeps its own bucket and its
 * own backoff, so a side path's refusals can never rest the live stream or the live poll (F2).
 */

/** What one upstream call came to. `missing` is an answer (the source has no such print), never a failure. */
export type UpstreamOutcome<T> =
  | { kind: "ok"; value: T }
  | { kind: "missing" }
  | { kind: "failed"; reason: string; rest: boolean };

/**
 * A token bucket with reservations: a caller may take the next token ahead of time and wait for it, but never longer
 * than its `maxWaitMs`; past that it is refused at once, so a flood is turned away instead of queued.
 */
export class TokenBucket {
  private tokens: number;
  private refilledAt = Date.now();

  constructor(
    private readonly ratePerSec: number,
    private readonly burst: number,
  ) {
    this.tokens = burst;
  }

  /** Milliseconds to wait before the reserved token is yours, or null (refused, nothing taken). */
  reserve(maxWaitMs: number): number | null {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.refilledAt) / MS_PER_SECOND) * this.ratePerSec);
    this.refilledAt = now;
    const waitMs = this.tokens >= 1 ? 0 : ((1 - this.tokens) / this.ratePerSec) * MS_PER_SECOND;
    if (waitMs > maxWaitMs) return null;
    this.tokens -= 1;
    return waitMs;
  }
}

/** A failing source rests, doubling from `minMs` to `maxMs`; one success brings the next rest back to `minMs`. */
export class Backoff {
  private nextMs: number;
  private restUntil = 0;

  constructor(
    private readonly minMs: number,
    private readonly maxMs: number,
  ) {
    this.nextMs = minMs;
  }

  /** Epoch ms the source rests until (in the past when it isn't resting). */
  get until(): number {
    return this.restUntil;
  }

  resting(now = Date.now()): boolean {
    return now < this.restUntil;
  }

  /** Rest for the current step, then double it. Returns the rest in ms. */
  fail(now = Date.now()): number {
    const restMs = this.nextMs;
    this.restUntil = now + restMs;
    this.nextMs = Math.min(restMs * 2, this.maxMs);
    return restMs;
  }

  ok(): void {
    this.nextMs = this.minMs;
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
