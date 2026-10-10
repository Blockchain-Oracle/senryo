/**
 * The one stream's bus (D-272): every event is serialised once into an SSE frame and the same string is written to
 * every socket that wants its topic (never a stringify per connection). Durable events (fills, results, payouts) enter
 * a replay ring so a reconnect with `Last-Event-ID` misses nothing; price ticks are ephemeral (a reconnect reseeds from
 * `/v1/prices/recent`). Ids are `<epoch>-<seq>` with a per-process epoch (Mitoshi `bus.ts`, 04-pricing R10): an id from
 * before a restart, or older than the ring, can't be replayed — `since` says so (null) and the client is told to reset,
 * never left to miss fills and results without a word. Price ticks go out as one batched `pp` frame per flush
 * (04-pricing R13), also serialised once as the older per-feed `p` frames for apps that haven't asked for `pp`.
 * Every fan-out is timed for `/status` (D-272: ≤ 50 µs per client per frame). A frame reaches sockets in slices of
 * `FANOUT_SLICE`, yielding to the event loop between slices, through one ordered queue (so no socket ever sees a later
 * frame first): measured at 5,000 sockets, one synchronous pass held the loop ~15 ms in `writev` every flush.
 */
import { FANOUT_SAMPLES, FANOUT_SLICE, REPLAY_RING_SIZE } from "./constants.ts";

export interface BusFrame {
  seq: number;
  topic: string;
  /** The ready-to-write SSE frame. */
  text: string;
  /** The same ticks as per-feed `p` frames, for a socket that didn't ask for batches (an app before R1.13). */
  legacy?: string;
}

type Listener = (frame: BusFrame) => void;

/** A compact tick `[catalogue index, priceE8, publish ms]`. */
export type Tick = readonly [number, number, number];

export interface FanoutStats {
  connections: number;
  /** Per client per frame, over the last `FANOUT_SAMPLES` fan-outs (µs). */
  perClientUs: { p50: number; p99: number; max: number } | null;
}

/** Epochs are the start time in base 36: short, and distinct across restarts. */
const EPOCH_RADIX = 36;
const US_PER_MS = 1_000;
const P50 = 0.5;
const P99 = 0.99;

const json = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

export class StreamBus {
  /** This process's epoch: a restart starts a new one. */
  readonly epoch = Date.now().toString(EPOCH_RADIX);
  private seq = 0;
  private readonly ring: BusFrame[] = [];
  private readonly listeners = new Set<Listener>();
  private readonly samples: number[] = [];
  /** Frames on their way out, in order, each with the sockets it was sent to and how far it has got. */
  private readonly queue: { frame: BusFrame; to: Listener[]; next: number; spentMs: number }[] = [];
  private pumping = false;

  /** A durable event: id'd, replayable. */
  emit(topic: string, event: string, data: unknown): void {
    this.seq += 1;
    const frame: BusFrame = {
      seq: this.seq,
      topic,
      text: `id: ${this.epoch}-${this.seq}\nevent: ${event}\ndata: ${json({ topic, data })}\n\n`,
    };
    this.ring.push(frame);
    if (this.ring.length > REPLAY_RING_SIZE) this.ring.shift();
    this.fanout(frame);
  }

  /** An ephemeral event: no id, never replayed. */
  tick(topic: string, event: string, data: unknown): void {
    this.fanout({ seq: 0, topic, text: `event: ${event}\ndata: ${json({ topic, data })}\n\n` });
  }

  /** One flush of price ticks: a `pp` batch, with its per-feed `p` form beside it. */
  ticks(topic: string, ticks: readonly Tick[]): void {
    if (ticks.length === 0) return;
    this.fanout({ seq: 0, topic, text: batchFrame(topic, ticks), legacy: legacyFrames(topic, ticks) });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Durable frames after `lastId` for the wanted topics; `null` when they can't be replayed: an id from another epoch
   * (before a restart, or an older client's bare number) or older than the ring.
   */
  since(lastId: string, wants: (topic: string) => boolean): BusFrame[] | null {
    const [epoch, seqText] = lastId.split("-");
    const last = Number(seqText);
    if (epoch !== this.epoch || !Number.isInteger(last)) return null;
    const oldest = this.ring[0]?.seq ?? this.seq + 1;
    if (last < oldest - 1) return null;
    return this.ring.filter((f) => f.seq > last && wants(f.topic));
  }

  stats(): FanoutStats {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const at = (q: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0);
    return {
      connections: this.listeners.size,
      perClientUs: sorted.length ? { p50: at(P50), p99: at(P99), max: Math.round(sorted.at(-1) ?? 0) } : null,
    };
  }

  private fanout(frame: BusFrame): void {
    if (this.listeners.size === 0) return;
    const to = [...this.listeners];
    // Nothing in flight and one slice's worth: out now. Otherwise behind what is queued, in order.
    if (!this.pumping && to.length <= FANOUT_SLICE) {
      const started = performance.now();
      for (const l of to) l(frame);
      this.record(performance.now() - started, to.length);
      return;
    }
    this.queue.push({ frame, to, next: 0, spentMs: 0 });
    if (!this.pumping) this.pump();
  }

  /** One slice of the oldest frame, then a turn for the event loop before the next. */
  private pump(): void {
    const job = this.queue[0];
    if (!job) {
      this.pumping = false;
      return;
    }
    this.pumping = true;
    const started = performance.now();
    const end = Math.min(job.to.length, job.next + FANOUT_SLICE);
    for (let i = job.next; i < end; i += 1) job.to[i]?.(job.frame);
    job.next = end;
    job.spentMs += performance.now() - started;
    if (job.next >= job.to.length) {
      this.queue.shift();
      this.record(job.spentMs, job.to.length);
    }
    setImmediate(() => this.pump());
  }

  private record(spentMs: number, clients: number): void {
    this.samples.push((spentMs * US_PER_MS) / clients);
    if (this.samples.length > FANOUT_SAMPLES) this.samples.shift();
  }
}

export function batchFrame(topic: string, ticks: readonly Tick[]): string {
  return `event: pp\ndata: ${JSON.stringify({ topic, data: ticks })}\n\n`;
}

export function legacyFrames(topic: string, ticks: readonly Tick[]): string {
  return ticks.map((t) => `event: p\ndata: ${JSON.stringify({ topic, data: t })}\n\n`).join("");
}
