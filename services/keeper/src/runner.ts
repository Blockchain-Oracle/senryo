import { describeError } from "@senryo/chain";
import type { Logger } from "@senryo/service-common";

/**
 * Minimal job scheduler: each job runs, then waits its interval (no overlap per job). Job errors are logged and the
 * loop continues. The runner's heartbeat (last completed run of any job) drives `/health` (KEEPER_STALE_SEC). Each
 * job's status is persisted at most every `PERSIST_EVERY_MS` (`keeper_state`, P6: the api's Status board reads when
 * each job last ran and last failed).
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

/** A job's status is written out at most this often (one row per job, updated in place). */
const PERSIST_EVERY_MS = 30_000;

export class Runner {
  private readonly status = new Map<string, JobStatus>();
  private readonly persisted = new Map<string, number>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private stopped = false;
  private heartbeat = Date.now();

  constructor(
    private readonly log: Logger,
    private readonly persist?: (job: string, status: JobStatus) => Promise<void>,
  ) {}

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

  private save(name: string, status: JobStatus): void {
    const now = Date.now();
    // A failure is written at once; a healthy run at most every PERSIST_EVERY_MS.
    if (!this.persist || (status.lastError === undefined && now - (this.persisted.get(name) ?? 0) < PERSIST_EVERY_MS)) {
      return;
    }
    this.persisted.set(name, now);
    void this.persist(name, { ...status }).catch((error: unknown) =>
      this.log.warn({ job: name, err: describeError(error) }, "job state not saved"),
    );
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
      // describeError keeps the short line only — viem's full message can carry a keyed RPC URL (S8.5b K5).
      const message = describeError(error);
      if (status) status.lastError = message;
      this.log.warn({ job: job.name, err: message }, "job failed");
    } finally {
      if (status) {
        status.lastRunAt = started;
        status.runs += 1;
      }
      this.heartbeat = Date.now();
      if (status) this.save(job.name, status);
    }
    if (this.stopped) return;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.loop(job);
    }, job.intervalMs);
    this.timers.add(timer);
  }
}
