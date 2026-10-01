import { INBOX_WATCH_TTL_DAYS } from "@senryo/config";
import type { Db } from "./db.ts";

/**
 * Register (or extend) a deposit inbox watch (S8.24, migration 0006): the api writes it when the app shows the address,
 * the keeper's `sweeps` job reads it until `expires_at`. Addresses are stored lowercase, one row per chain + user.
 */
export async function watchInbox(db: Db, chainId: number, user: string, inbox: string): Promise<Date> {
  const [row] = await db<{ expires_at: Date }[]>`
    INSERT INTO inbox_watches (chain_id, user_address, inbox, expires_at)
    VALUES (${chainId}, ${user.toLowerCase()}, ${inbox.toLowerCase()},
            now() + make_interval(days => ${INBOX_WATCH_TTL_DAYS}))
    ON CONFLICT (chain_id, user_address) DO UPDATE
      SET expires_at = EXCLUDED.expires_at, inbox = EXCLUDED.inbox, updated_at = now()
    RETURNING expires_at`;
  if (!row) throw new Error("inbox watch upsert returned no row");
  return row.expires_at;
}
