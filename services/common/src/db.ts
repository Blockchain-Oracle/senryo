import postgres from "postgres";
import * as m0001 from "../migrations/0001_card_ledger.ts";
import * as m0002 from "../migrations/0002_api.ts";
import * as m0003 from "../migrations/0003_cards.ts";
import * as m0004 from "../migrations/0004_starter_topup.ts";
import * as m0005 from "../migrations/0005_social.ts";
import * as m0006 from "../migrations/0006_inbox_watches.ts";
import * as m0007 from "../migrations/0007_social_feed.ts";
import * as m0008 from "../migrations/0008_push_tickets.ts";
import * as m0009 from "../migrations/0009_notification_inbox.ts";
import * as m0010 from "../migrations/0010_card_issue.ts";
import type { Logger } from "./logger.ts";

/**
 * Postgres 17 ledger. int8 columns decode to `bigint` (postgres.BigInt) so usd6 never passes through a float;
 * numeric(78,0) (wei, 1e18 prices) arrives as a string and is converted with `BigInt()` at the edge.
 */
export type Db = postgres.Sql<{ bigint: bigint }>;
/** The scoped `sql` inside `db.begin(…)`. */
export type Tx = postgres.TransactionSql<{ bigint: bigint }>;

/** Pool sizes per service (256 MiB ledger, three small containers). */
export const DB_POOL_MAX = 8;
const IDLE_TIMEOUT_S = 30;
const CONNECT_TIMEOUT_S = 10;

export function createDb(url: string, applicationName: string, max: number = DB_POOL_MAX): Db {
  return postgres(url, {
    max,
    idle_timeout: IDLE_TIMEOUT_S,
    connect_timeout: CONNECT_TIMEOUT_S,
    connection: { application_name: applicationName },
    types: { bigint: postgres.BigInt },
    onnotice: () => undefined,
  });
}

/** Ordered, append-only. Never edit an applied migration — add the next one. */
export const MIGRATIONS: ReadonlyArray<{ id: string; sql: string }> = [
  m0001,
  m0002,
  m0003,
  m0004,
  m0005,
  m0006,
  m0007,
  m0008,
  m0009,
  m0010,
];

/** Session-level advisory lock key so three containers starting together migrate once. */
const MIGRATION_LOCK_KEY = 0x53_45_4e_52_59_4f; // "SENRYO"

export async function migrate(db: Db, log: Logger): Promise<string[]> {
  const applied: string[] = [];
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`;
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const done = new Set((await tx<{ id: string }[]>`SELECT id FROM schema_migrations`).map((row) => row.id));
    for (const migration of MIGRATIONS) {
      if (done.has(migration.id)) continue;
      await tx.unsafe(migration.sql);
      await tx`INSERT INTO schema_migrations (id) VALUES (${migration.id})`;
      applied.push(migration.id);
    }
  });
  if (applied.length > 0) log.info({ applied }, "migrations applied");
  return applied;
}

/** `SELECT 1` with a short timeout — the readiness probe (never the container health check). */
export async function pingDb(db: Db): Promise<boolean> {
  try {
    await db`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
