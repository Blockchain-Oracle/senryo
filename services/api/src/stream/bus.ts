/**
 * The one stream's bus (D-272): every event is serialised once into an SSE frame and the same string is written to
 * every socket that wants its topic (never a stringify per connection). Durable events (fills, results, payouts) enter
 * a replay ring so a reconnect with `Last-Event-ID` misses nothing; price ticks are ephemeral (a reconnect reseeds from
 * `/v1/prices/recent`). Ids are `<epoch>-<seq>` with a per-process epoch (Mitoshi `bus.ts`, 04-pricing R10): an id from
 * before a restart, or older than the ring, can't be replayed — `since` says so (null) and the client is told to reset,
 * never left to miss fills and results without a word.
 */
import { REPLAY_RING_SIZE } from "./constants.ts";

export interface BusFrame {
  seq: number;
  topic: string;
  /** The ready-to-write SSE frame. */
  text: string;
}

type Listener = (frame: BusFrame) => void;

/** Epochs are the start time in base 36: short, and distinct across restarts. */
const EPOCH_RADIX = 36;

const json = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

export class StreamBus {
  /** This process's epoch: a restart starts a new one. */
  readonly epoch = Date.now().toString(EPOCH_RADIX);
  private seq = 0;
  private readonly ring: BusFrame[] = [];
  private readonly listeners = new Set<Listener>();

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
    for (const l of this.listeners) l(frame);
  }

  /** An ephemeral event (price ticks): no id, never replayed. */
  tick(topic: string, event: string, data: unknown): void {
    const frame: BusFrame = { seq: 0, topic, text: `event: ${event}\ndata: ${json({ topic, data })}\n\n` };
    for (const l of this.listeners) l(frame);
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

  connections(): number {
    return this.listeners.size;
  }
}
