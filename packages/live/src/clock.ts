// Countdowns, the 20 s lockout and every signed deadline read the server's clock, never the phone's (04-pricing R16,
// F12). NTP-style: `offset = server − (t0 + t1) / 2` from `GET /v1/time` (never cached), keeping the sample with the
// smallest round trip of the last few — its error is at most half that trip — resampled every minute and on each
// reconnect. Until a timed sample exists (an older api), stream beats give a rough one: the median of the last few,
// without the one-way latency correction (~60 ms measured).
const MS_PER_SECOND = 1000;
const SAMPLES = 5;
const HALF = 2;

export class ServerClock {
  private readonly timed: { offset: number; rtt: number }[] = [];
  private readonly rough: number[] = [];
  private offsetMs = 0;

  /** A timed round trip: `t0` before the request, `t1` after the answer, `serverMs` read from it. */
  sync(serverMs: number, t0: number, t1: number): void {
    if (!Number.isFinite(serverMs) || t1 < t0) return;
    this.timed.push({ offset: serverMs - (t0 + t1) / HALF, rtt: t1 - t0 });
    if (this.timed.length > SAMPLES) this.timed.shift();
    const best = this.timed.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.offsetMs = Math.round(best.offset);
  }

  /** One rough observation of the server's clock (`serverMs`) at local time `localMs`: used only until a timed one. */
  sample(serverMs: number, localMs: number = Date.now()): void {
    if (!Number.isFinite(serverMs) || this.timed.length > 0) return;
    this.rough.push(serverMs - localMs);
    if (this.rough.length > SAMPLES) this.rough.shift();
    const sorted = [...this.rough].sort((a, b) => a - b);
    this.offsetMs = sorted[Math.floor(sorted.length / HALF)] ?? 0;
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

  /** The round trip of the sample the offset rests on (null while only rough samples exist). */
  get uncertaintyMs(): number | null {
    if (this.timed.length === 0) return null;
    return this.timed.reduce((a, b) => (b.rtt < a.rtt ? b : a)).rtt / HALF;
  }
}
