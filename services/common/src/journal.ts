import type { Hex, JournalEntry, TxJournal } from "@senryo/chain";
import type { Db } from "./db.ts";

/**
 * The services' tx journal (`relay_journal`): every relayed or keeper tx is written with its signed bytes before it is
 * broadcast, so a restart reconciles it against the chain and never loses or double-signs one (D-266).
 */
export function pgJournal(db: Db, scope: string): TxJournal {
  const keyOf = (hash: Hex) => `${scope}:${hash}`;
  return {
    async put(entry: JournalEntry) {
      await db`INSERT INTO relay_journal (key, value) VALUES (${keyOf(entry.hash)}, ${JSON.stringify(entry)})
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    },
    async update(hash, patch) {
      const [row] = await db<{ value: string }[]>`SELECT value FROM relay_journal WHERE key = ${keyOf(hash)}`;
      if (!row) return;
      const next = { ...(JSON.parse(row.value) as JournalEntry), ...patch, updatedAt: Date.now() };
      await db`UPDATE relay_journal SET value = ${JSON.stringify(next)}, updated_at = now() WHERE key = ${keyOf(hash)}`;
    },
    async list() {
      const rows = await db<{ value: string }[]>`SELECT value FROM relay_journal WHERE key LIKE ${`${scope}:%`}`;
      return rows.map((r) => JSON.parse(r.value) as JournalEntry);
    },
    async remove(hash) {
      await db`DELETE FROM relay_journal WHERE key = ${keyOf(hash)}`;
    },
  };
}
