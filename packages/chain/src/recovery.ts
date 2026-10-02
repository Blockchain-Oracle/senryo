import type { TxStage } from "@senryo/core";
import type { TransactionReceipt } from "viem";
import type { ReadClient } from "./clients.ts";
import type { JournalEntry } from "./journal.ts";

/**
 * TxRecovery (S8.24, D-179): what became of a journaled tx after the app was killed or the send stopped watching.
 * Reads only its own chain (the entry's `chainId` picks the client) and NEVER broadcasts, not even the same signed
 * bytes. A trade replayed minutes later could fill at a price the user has walked away from. The nonce decides
 * instead: once it is used, the tx can never land twice.
 *  - receipt at or below the finalized head, canonical block → `finalized` / `reverted`
 *  - receipt above the finalized head (or a superseded block) → still `pending`, look again
 *  - no receipt, the finalized nonce moved past it → `abandoned` (another tx used the nonce)
 *  - no receipt, nonce not consumed → pending, however long the watch has been interrupted
 */
export type Reconciled =
  | { kind: "pending" }
  | { kind: "settled"; stage: Extract<TxStage, "finalized" | "reverted">; receipt: TransactionReceipt }
  | { kind: "abandoned"; reason: "nonce-used" | "dropped" };

export async function reconcileEntry(read: ReadClient, entry: JournalEntry, _now = Date.now()): Promise<Reconciled> {
  const receipt = await read.getTransactionReceipt({ hash: entry.hash }).catch(() => undefined);
  if (receipt) {
    const finalized = await read.getBlock({ blockTag: "finalized" });
    if (receipt.blockNumber > finalized.number) return { kind: "pending" };
    const canonical = await read.getBlock({ blockNumber: receipt.blockNumber });
    if (canonical.hash !== receipt.blockHash) return { kind: "pending" };
    return { kind: "settled", stage: receipt.status === "reverted" ? "reverted" : "finalized", receipt };
  }
  const used = await read.getTransactionCount({ address: entry.from, blockTag: "finalized" });
  if (used > entry.nonce) return { kind: "abandoned", reason: "nonce-used" };
  return { kind: "pending" };
}
