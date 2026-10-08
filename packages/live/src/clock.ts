// Countdowns never trust the phone (pivot craft list): every `time` beat (15 s) and `/recent`'s `serverTime` give a
// sample of server − local; the clock uses the median of the last few, so one slow frame doesn't jerk the ring.
const MS_PER_SECOND = 1000;
const SAMPLES = 5;

export class ServerClock {
  private readonly offsets: number[] = [];
  private offsetMs = 0;

  /** One observation of the server's clock (`serverMs`) at local time `localMs`. */
  sample(serverMs: number, localMs: number = Date.now()): void {
    if (!Number.isFinite(serverMs)) return;
    this.offsets.push(serverMs - localMs);
    if (this.offsets.length > SAMPLES) this.offsets.shift();
    const sorted = [...this.offsets].sort((a, b) => a - b);
    this.offsetMs = sorted[Math.floor(sorted.length / 2)] ?? 0;
  }

  /** Server time now, in ms. */
  now(): number {
    return Date.now() + this.offsetMs;
  }

  /** Server time now, in whole seconds. */
  nowSec(): number {
    return Math.floor(this.now() / MS_PER_SECOND);
  }

  get offset(): number {
    return this.offsetMs;
  }
}
