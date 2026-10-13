import type { ReadClient, Sender, Signer, TicketChange } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db, Logger } from "@senryo/service-common";
import type { KeeperEnv } from "./env.ts";
import type { Notifier } from "./notify.ts";

export interface KeeperContext {
  env: KeeperEnv;
  chainId: ChainId;
  read: ReadClient;
  sender: Sender;
  /** The keeper's key: it sends, and signs σ marks (an allowed signer, D-313). */
  signer: Signer;
  db: Db;
  log: Logger;
  notifier: Notifier;
  /** Recent onchain actions (exposed on `/v1/keeper/status` for ops and the drive script). */
  recent: RecentActions;
  /** Subjects whose last transaction made no progress, waiting before the next try (`Stalls`). */
  stalls: Stalls;
  /** Pushes wins and refunds from a receipt's ticket changes. */
  notifyResults: (changes: readonly TicketChange[]) => Promise<void>;
}

export interface KeeperAction {
  job: string;
  subject: string;
  tx: string;
  stage: string;
  at: string;
}

const RECENT_MAX = 50;

export class RecentActions {
  private readonly items: KeeperAction[] = [];

  add(action: Omit<KeeperAction, "at">): void {
    this.items.unshift({ ...action, at: new Date().toISOString() });
    this.items.length = Math.min(this.items.length, RECENT_MAX);
  }

  list(): readonly KeeperAction[] {
    return this.items;
  }
}

/** The first wait after a transaction that changed nothing, doubling on each further one up to the cap. */
const STALL_FIRST_MS = 30_000;
const STALL_MAX_MS = 1_800_000; // 30 min
const DOUBLE = 2;

/**
 * A subject (a window, a parlay) whose last transaction landed but emitted nothing — every step tolerated its own
 * failure — made no progress, and on Monad still paid its whole gas limit. It waits before the next try, 30 s then
 * doubling to 30 min, instead of retrying every tick (13 Oct: one such loop drained the keeper in minutes). Any
 * progress clears it.
 */
export class Stalls {
  private readonly waits = new Map<string, { until: number; wait: number }>();

  blocked(subject: string, nowMs = Date.now()): boolean {
    const s = this.waits.get(subject);
    return s !== undefined && nowMs < s.until;
  }

  /** After a landed transaction: `progressed` when it emitted any event. Returns the wait set, or 0. */
  record(subject: string, progressed: boolean, nowMs = Date.now()): number {
    if (progressed) {
      this.waits.delete(subject);
      return 0;
    }
    const prior = this.waits.get(subject)?.wait;
    const wait = prior === undefined ? STALL_FIRST_MS : Math.min(prior * DOUBLE, STALL_MAX_MS);
    this.waits.set(subject, { until: nowMs + wait, wait });
    return wait;
  }
}

/** Persist a job cursor/heartbeat in `keeper_state` (survives restarts; read by ops). */
export async function saveJobState(db: Db, job: string, state: Record<string, unknown>): Promise<void> {
  await db`
    INSERT INTO keeper_state (job, last_tick_at, state) VALUES (${job}, now(), ${db.json(state as never)})
    ON CONFLICT (job) DO UPDATE SET last_tick_at = now(), state = EXCLUDED.state`;
}

export async function loadJobState<T extends Record<string, unknown>>(db: Db, job: string): Promise<T | undefined> {
  const [row] = await db<{ state: T }[]>`SELECT state FROM keeper_state WHERE job = ${job}`;
  return row?.state;
}
