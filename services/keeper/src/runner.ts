import type { Logger } from "@senryo/service-common";

/**
 * Minimal job scheduler: each job runs, then waits its interval (no overlap per job). Job errors are logged and the
 * loop continues. The runner's heartbeat (last completed run of any job) drives `/health` (KEEPER_STALE_SEC).
 */
export interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

export interface JobStatus {
  lastRunAt: number;
  lastOkAt: number;
  lastError: string | undefined;
  runs: number;
}

export class Runner {
  private readonly status = new Map<string, JobStatus>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private stopped = false;
  private heartbeat = Date.now();

  constructor(private readonly log: Logger) {}

  start(jobs: readonly Job[]): void {
    for (const job of jobs) {
      this.status.set(job.name, { lastRunAt: 0, lastOkAt: 0, lastError: undefined, runs: 0 });
      void this.loop(job);
    }
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  lastHeartbeat(): number {
    return this.heartbeat;
  }

  snapshot(): Record<string, JobStatus> {
    return Object.fromEntries(this.status);
  }

  private async loop(job: Job): Promise<void> {
    if (this.stopped) return;
    const status = this.status.get(job.name);
    const started = Date.now();
    try {
      await job.run();
      if (status) {
        status.lastOkAt = Date.now();
        status.lastError = undefined;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (status) status.lastError = message;
      this.log.warn({ job: job.name, err: message }, "job failed");
    } finally {
      if (status) {
        status.lastRunAt = started;
        status.runs += 1;
      }
      this.heartbeat = Date.now();
    }
    if (this.stopped) return;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.loop(job);
    }, job.intervalMs);
    this.timers.add(timer);
  }
}
