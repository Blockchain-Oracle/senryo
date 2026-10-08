import type { Hex } from "@senryo/chain";
import { MS_PER_SECOND } from "@senryo/service-common";
import { PRINT_WAIT_MS, RECENT_WINDOW_SEC, RING_KEEP_SEC } from "./constants.ts";

/**
 * One Pyth update for one feed, as streamed: the update bytes prove every instant `t` with `prev < t ≤ publish` — the
 * unique print of `t` (D-259). A streamed update may repeat its publish time (`prev == publish`): it proves nothing new
 * and is kept for the live price only.
 */
export interface PriceUpdate {
  feedId: Hex;
  publishTime: number;
  prevPublishTime: number;
  price: bigint;
  conf: bigint;
  expo: number;
  /** The accumulator update(s) carrying this feed, hex, as `bytes[]` for the verifier. */
  updates: Hex[];
  receivedAt: number;
}

export function provesInstant(u: PriceUpdate, t: number): boolean {
  return u.prevPublishTime < t && t <= u.publishTime;
}

interface Waiter {
  t: number;
  resolve: (u: PriceUpdate | undefined) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Per feed, the last few minutes of updates (enough to prove any fill or boundary the relay asks for while the stream
 * is up), waiters for instants not printed yet, and one sample per second for first paint (`/v1/prices/recent`).
 */
export class FeedRing {
  private readonly updates: PriceUpdate[] = [];
  private readonly waiters = new Set<Waiter>();
  /** `[unix ms, priceE8]`, at most one per publish second. */
  private readonly samples: Array<[number, number]> = [];

  constructor(readonly feedId: Hex) {}

  push(u: PriceUpdate): void {
    const last = this.updates.at(-1);
    // A reconnect or the rotation overlap replays updates: never rewind, never keep a duplicate.
    if (
      last &&
      (u.publishTime < last.publishTime ||
        (u.publishTime === last.publishTime && u.prevPublishTime === last.prevPublishTime))
    )
      return;
    this.updates.push(u);
    const cutoff = u.publishTime - RING_KEEP_SEC;
    while (this.updates.length > 0 && (this.updates[0]?.publishTime ?? 0) < cutoff) this.updates.shift();
    this.sample(u);
    for (const w of this.waiters) {
      if (!provesInstant(u, w.t)) continue;
      clearTimeout(w.timer);
      this.waiters.delete(w);
      w.resolve(u);
    }
  }

  latest(): PriceUpdate | undefined {
    return this.updates.at(-1);
  }

  /** The update proving `t`, if it is still in the ring. */
  proving(t: number): PriceUpdate | undefined {
    for (let i = this.updates.length - 1; i >= 0; i -= 1) {
      const u = this.updates[i];
      if (u && provesInstant(u, t)) return u;
      if (u && u.publishTime < t) return undefined;
    }
    return undefined;
  }

  /** Resolves with the update proving `t` as soon as it streams in (or `undefined` after `timeoutMs`). */
  wait(t: number, timeoutMs: number = PRINT_WAIT_MS): Promise<PriceUpdate | undefined> {
    const now = this.proving(t);
    if (now) return Promise.resolve(now);
    return new Promise((resolve) => {
      const waiter: Waiter = {
        t,
        resolve,
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          resolve(undefined);
        }, timeoutMs),
      };
      this.waiters.add(waiter);
    });
  }

  recent(): Array<[number, number]> {
    return [...this.samples];
  }

  private sample(u: PriceUpdate): void {
    const ms = u.publishTime * MS_PER_SECOND;
    const priceE8 = Number(toE8(u.price, u.expo));
    const last = this.samples.at(-1);
    if (last && last[0] === ms) last[1] = priceE8;
    else this.samples.push([ms, priceE8]);
    const cutoff = ms - RECENT_WINDOW_SEC * MS_PER_SECOND;
    while (this.samples.length > 0 && (this.samples[0]?.[0] ?? 0) < cutoff) this.samples.shift();
  }
}

const PRINT_EXPO = -8;
const TEN = 10n;

/** A Pyth price at any exponent → e-8 (the contracts' scale; floored when finer, as `PythPrintVerifier.normalize`). */
export function toE8(price: bigint, expo: number): bigint {
  if (expo >= PRINT_EXPO) return price * TEN ** BigInt(expo - PRINT_EXPO);
  return price / TEN ** BigInt(PRINT_EXPO - expo);
}
