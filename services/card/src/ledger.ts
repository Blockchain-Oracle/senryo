import { randomUUID } from "node:crypto";
import type { Db, Tx } from "@senryo/service-common";

/**
 * Double-entry card ledger (`ledger_entries`; view `ledger_unbalanced` must stay empty). Books, per account `a`:
 *   user:a:free  → user:a:held   hold finalized onchain
 *   user:a:held  → user:a:free   hold released (or the released remainder of a capture)
 *   user:a:held  → card_float    capture (money leaves the user to the card float)
 *   card_float   → user:a:free   refund
 * The chain is authoritative; these rows are the service's audit trail and reconciliation input.
 */
export type Posting = readonly [debit: string, credit: string, amountUsd6: bigint];

export const books = {
  free: (account: string) => `user:${account.toLowerCase()}:free`,
  held: (account: string) => `user:${account.toLowerCase()}:held`,
  cardFloat: "card_float",
} as const;

type Sql = Db | Tx;

export async function post(
  sql: Sql,
  chainId: number,
  refType: string,
  refId: string,
  postings: readonly Posting[],
): Promise<void> {
  const group = randomUUID();
  const rows = postings
    .filter(([, , amount]) => amount > 0n)
    .flatMap(([debit, credit, amount]) => [
      {
        entry_group: group,
        chain_id: chainId,
        book: debit,
        direction: "D",
        amount_usd6: amount,
        ref_type: refType,
        ref_id: refId,
      },
      {
        entry_group: group,
        chain_id: chainId,
        book: credit,
        direction: "C",
        amount_usd6: amount,
        ref_type: refType,
        ref_id: refId,
      },
    ]);
  if (rows.length === 0) return;
  await sql`INSERT INTO ledger_entries ${sql(rows, "entry_group", "chain_id", "book", "direction", "amount_usd6", "ref_type", "ref_id")}`;
}
