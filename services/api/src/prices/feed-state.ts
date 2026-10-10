import {
  CALENDARS,
  FEED_STATE_CODE,
  FEED_STATES,
  type FeedState,
  feedTimingOf,
  type MarketSpec,
  worstState,
} from "@senryo/config";
import { isOpenAt, scheduleOf } from "@senryo/core";
import { MS_PER_SECOND } from "@senryo/service-common";
import { DISPLAY_FRESH_MS, FEED_STATE_STEP_MS, HALT_CONF_BPS, HALT_STALE_MS } from "./constants.ts";
import type { PriceUpdate } from "./ring.ts";

/**
 * Each market's state, every second, from server time (04-pricing R6, F7/F8): its calendar first (`closed`), then a
 * D-289 halt for a Pyth feed (stale past 15 s or wider than 50 bps while open — confirmed by two observations in a row,
 * Owarine's `confirmHalt`, so one late tick never flips it), then the price's age against its source's own cadence. A
 * live price is demoted to delayed only on a second observation too: Pyth stamps whole seconds, so one slow tick can
 * read 2.5 s old for an instant (1 s truncation + ~0.3 s lag + a 1.4 s gap, measured). A stall past stale is at once. A
 * basket takes its worst member's state. Any change sends the whole digest (one letter per catalogue index); the beat
 * repeats it, so a client that missed one heals within a beat.
 */
type HaltReason = "stale" | "wide";

interface Halt {
  confirmed: HaltReason | null;
  /** An observation that differs from `confirmed`, and how many times in a row it was seen (0: none). */
  pending: HaltReason | null;
  seen: number;
}

export interface StateFeed {
  index: number;
  market: MarketSpec;
  latest(): PriceUpdate | undefined;
  /** When this market's display line last moved (ms), or null (no display line). */
  displayAt(): number | null;
  /** A basket's member indexes (empty for a single feed). */
  members: readonly number[];
}

const NO_HALT: Halt = { confirmed: null, pending: null, seen: 0 };
const CONFIRM_PASSES = 2;
const BPS = 10_000n;

/** One observation against the confirmed halt: a change takes effect only after two observations in a row. */
export function confirmHalt(h: Halt, observed: HaltReason | null): Halt {
  if (observed === h.confirmed) return { confirmed: h.confirmed, pending: null, seen: 0 };
  const seen = h.seen > 0 && h.pending === observed ? h.seen + 1 : 1;
  return seen >= CONFIRM_PASSES
    ? { ...NO_HALT, confirmed: observed }
    : { confirmed: h.confirmed, pending: observed, seen };
}

export function haltObserved(u: PriceUpdate | undefined, nowMs: number): HaltReason | null {
  if (!u || nowMs - u.publishTime * MS_PER_SECOND > HALT_STALE_MS) return "stale";
  return u.price > 0n && u.conf * BPS > u.price * BigInt(HALT_CONF_BPS) ? "wide" : null;
}

export class FeedStates {
  private readonly states: FeedState[];
  private readonly halts = new Map<number, Halt>();
  /** Feeds seen late once while live (the demotion waits for a second look). */
  private readonly lateOnce = new Set<number>();
  private text: string;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly feeds: readonly StateFeed[],
    private readonly onChange: (digest: string) => void,
  ) {
    this.states = feeds.map(() => "stale");
    this.text = this.encode();
  }

  start(): void {
    this.step(Date.now());
    this.timer = setInterval(() => this.step(Date.now()), FEED_STATE_STEP_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  /** One letter per catalogue index (`FEED_STATE_CODE`). */
  digest(): string {
    return this.text;
  }

  stateOf(index: number): FeedState {
    return this.states[index] ?? "stale";
  }

  /** How many markets are in each state, per source (`/status`). */
  counts(): Record<string, Record<FeedState, number>> {
    const out: Record<string, Record<FeedState, number>> = {};
    for (const f of this.feeds) {
      const source = f.market.source.kind;
      out[source] ??= Object.fromEntries(FEED_STATES.map((s) => [s, 0])) as Record<FeedState, number>;
      out[source][this.stateOf(f.index)] += 1;
    }
    return out;
  }

  step(nowMs: number): void {
    for (const f of this.feeds) if (f.members.length === 0) this.states[f.index] = this.observe(f, nowMs);
    for (const f of this.feeds) {
      if (f.members.length === 0) continue;
      this.states[f.index] = this.closed(f, nowMs) ? "closed" : worstState(f.members.map((i) => this.stateOf(i)));
    }
    const text = this.encode();
    if (text === this.text) return;
    this.text = text;
    this.onChange(text);
  }

  private closed(f: StateFeed, nowMs: number): boolean {
    return !isOpenAt(scheduleOf(CALENDARS[f.market.calendarId].schedule), Math.floor(nowMs / MS_PER_SECOND));
  }

  private observe(f: StateFeed, nowMs: number): FeedState {
    if (this.closed(f, nowMs)) {
      this.halts.delete(f.index);
      return "closed";
    }
    const latest = f.latest();
    if (f.market.source.kind === "pyth") {
      const halt = confirmHalt(this.halts.get(f.index) ?? NO_HALT, haltObserved(latest, nowMs));
      this.halts.set(f.index, halt);
      if (halt.confirmed) return "halted";
    }
    if (!latest) return "stale";
    const ageMs = nowMs - latest.publishTime * MS_PER_SECOND;
    const timing = feedTimingOf(f.market);
    const state: FeedState = ageMs <= timing.delayedMs ? "live" : ageMs <= timing.staleMs ? "delayed" : "stale";
    const firstLateLook = state === "delayed" && this.stateOf(f.index) === "live" && !this.lateOnce.has(f.index);
    if (firstLateLook) this.lateOnce.add(f.index);
    else this.lateOnce.delete(f.index);
    if (firstLateLook) return "live";
    // The settlement price is late but the exchange line still moves: the line keeps going, labelled, and no quote.
    const displayAt = f.displayAt();
    if (state !== "live" && displayAt !== null && nowMs - displayAt <= DISPLAY_FRESH_MS) return "fallback";
    return state;
  }

  private encode(): string {
    return this.states.map((s) => FEED_STATE_CODE[s]).join("");
  }
}
