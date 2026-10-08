/** Bounded observations, not a realized win/loss classifier. A stale/background gap establishes a new baseline. */
const FUTURE_TOLERANCE_MS = 5000;
const MAX_AGE_MS = 30_000;
const COOLDOWN_MS = 15_000;
const MIN_MOVEMENT_USD6 = 1_000_000n;
export class MovementBaseline {
  private previous: { key: string; source: number; value: bigint } | undefined;
  private lastCue = 0;
  observe(key: string, source: number, value: bigint, now: number, eligible: boolean): "up" | "down" | undefined {
    const prior = this.previous;
    if (!eligible || source > now + FUTURE_TOLERANCE_MS || now - source > MAX_AGE_MS) {
      this.previous = undefined;
      return;
    }
    if (prior && source <= prior.source) return;
    this.previous = { key, source, value };
    if (!prior || prior.key !== key || source - prior.source > MAX_AGE_MS || now - this.lastCue < COOLDOWN_MS) return;
    const delta = value - prior.value;
    // One dollar of unrealized net movement before any optional reaction.
    if (delta > -MIN_MOVEMENT_USD6 && delta < MIN_MOVEMENT_USD6) return;
    this.lastCue = now;
    return delta > 0n ? "up" : "down";
  }
}
