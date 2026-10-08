import type { ReadClient, Sender, TicketChange } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Db, Logger } from "@senryo/service-common";
import type { KeeperEnv } from "./env.ts";
import type { Notifier } from "./notify.ts";

export interface KeeperContext {
  env: KeeperEnv;
  chainId: ChainId;
  read: ReadClient;
  sender: Sender;
  db: Db;
  log: Logger;
  notifier: Notifier;
  /** Recent onchain actions (exposed on `/v1/keeper/status` for ops and the drive script). */
  recent: RecentActions;
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
