import type { Db } from "./db.ts";
import type { Logger } from "./logger.ts";

/**
 * Per-stage timings for a latency-critical flow (card authorisation: verify → lock → snapshot → sign → send → finalized
 * → respond). Marks are cheap in the hot path; `flush` writes one row per stage to `latency_samples` after the
 * response has gone out (specs/services.md §card 7).
 */
export class LatencyTimer {
  private readonly start = performance.now();
  private last = this.start;
  private readonly marks: Array<{ stage: string; ms: number }> = [];

  constructor(
    readonly service: string,
    readonly flow: string,
    public refId?: string,
  ) {}

  /** Record the time since the previous mark under `stage`. */
  mark(stage: string): number {
    const now = performance.now();
    const ms = Math.round(now - this.last);
    this.last = now;
    this.marks.push({ stage, ms });
    return ms;
  }

  elapsed(): number {
    return Math.round(performance.now() - this.start);
  }

  summary(): Record<string, number> {
    return Object.fromEntries([...this.marks.map((m) => [m.stage, m.ms] as const), ["total", this.elapsed()] as const]);
  }

  /** Insert all marks + a `total` row; never throws into the caller. */
  async flush(db: Db, log: Logger): Promise<void> {
    const rows = [...this.marks, { stage: "total", ms: this.elapsed() }].map((m) => ({
      service: this.service,
      flow: this.flow,
      ref_id: this.refId ?? null,
      stage: m.stage,
      ms: m.ms,
    }));
    try {
      await db`INSERT INTO latency_samples ${db(rows, "service", "flow", "ref_id", "stage", "ms")}`;
    } catch (error) {
      log.warn({ err: error, flow: this.flow }, "latency flush failed");
    }
  }
}
