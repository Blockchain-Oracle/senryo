/**
 * User sends (S6.12 — the seam S8's trade flows call): `@senryo/chain` is the only sender, the Mera scoped signer is
 * its viem `account` (the policy runs before every signature; one Face ID read when locked), nonces run through
 * `@senryo/account`'s per-address queue around chain's `LocalNonceSource`, and the lifecycle journal lives in MMKV
 * (`kvJournal`, capped) so an app kill mid-send is reconciled on the next launch by `recoverJournal` (S8.24) — read
 * only, on each entry's own chain, never re-broadcast.
 */
import {
  type AccountClient,
  type Address,
  type FaceIdMode,
  type LocalAccount,
  type PolicyContext,
  queuedNonces,
} from "@senryo/account";
import {
  createReadClient,
  createSender,
  type JournalEntry,
  type KvStore,
  kvJournal,
  LocalNonceSource,
  type NonceSource,
  type ReadClient,
  type Reconciled,
  receiptFacts,
  reconcileEntry,
  type Sender,
} from "@senryo/chain";
import { type ChainId, isChainId } from "@senryo/config";
import { isTerminalStage } from "@senryo/core";
import { operationOutcome, readOperation, userFeeCache, writeOperation } from "@senryo/query";
import { activeNetwork } from "~/lib/network";
import { storage } from "~/lib/storage";
import { policyContext } from "./api";

const mmkv: KvStore = {
  getItem: (key) => storage.getString(key),
  setItem: (key, value) => storage.set(key, value),
};
const journal = kvJournal(mmkv);

/** A live send watches its own tx for ≤ RECEIPT + FINALIZE timeouts (27 s); recovery leaves younger entries to it. */
const RECOVERY_MIN_AGE_MS = 30_000;
/** Reconciled entries stay this long (a pending screen can still read its outcome), then go. */
const SETTLED_KEEP_MS = 86_400_000;

/**
 * One read client and one nonce counter PER CHAIN (S8.22): a nonce cached for an address on practice must never be
 * reused on mainnet (the counter is keyed by address only), and reads must follow the selected network.
 */
const reads = new Map<ChainId, ReadClient>();
const nonceSources = new Map<ChainId, NonceSource>();

/** The app's viem read client for a chain (default: the selected network). */
export function sharedRead(chainId: ChainId = activeNetwork().chainId): ReadClient {
  let read = reads.get(chainId);
  if (!read) {
    read = createReadClient(chainId);
    reads.set(chainId, read);
  }
  return read;
}

function sharedNonces(chainId: ChainId): NonceSource {
  let nonces = nonceSources.get(chainId);
  if (!nonces) {
    nonces = queuedNonces(new LocalNonceSource(sharedRead(chainId)));
    nonceSources.set(chainId, nonces);
  }
  return nonces;
}

/**
 * What a trade call site knows that the policy needs (S8): market room, equity, a label for the Face ID prompt — and,
 * for a Perpl order (D1), the Perpl market's own label ("Confirm long $60.00 Bitcoin on Perpl").
 */
export type TradeContext = Pick<PolicyContext, "marketRoomUsd6" | "equityUsd6" | "marketLabel" | "perplMarketLabel">;

/**
 * One sender per call site; the read client and the nonce counter are shared by the whole app. A trade passes its
 * `TradeContext` so the session policy can judge the open in scope instead of asking for a step-up.
 */
export function userSender(
  client: AccountClient,
  address: Address,
  faceId: FaceIdMode | undefined,
  trade?: TradeContext,
): Sender {
  const chainId = activeNetwork().chainId;
  const read = sharedRead(chainId);
  const base = policyContext(address, faceId);
  return createSender({
    chainId,
    account: client.signer(trade ? () => ({ ...base(), ...trade }) : base),
    read,
    nonces: sharedNonces(chainId),
    journal,
    // The same quote the gas budget uses (D-171): what the ticket checks is exactly what gets signed.
    fees: userFeeCache(read),
  });
}

/**
 * A sender for a one-shot, unscoped signer from a step-up ceremony (`account.stepUp`): sends outside the session's
 * scope (to someone else's address). It shares the app's read client, nonce counter, journal and fee quote, so the
 * send is journalled and recovered like any other; the signer ends when the ceremony's callback returns.
 */
export function stepUpSender(signer: LocalAccount): Sender {
  const chainId = activeNetwork().chainId;
  const read = sharedRead(chainId);
  return createSender({
    chainId,
    account: signer,
    read,
    nonces: sharedNonces(chainId),
    journal,
    fees: userFeeCache(read),
  });
}

/**
 * The send journal as it stands (settled entries stay SETTLED_KEEP_MS). A screen whose live watch lost a signed tx
 * reads its true outcome here once TxRecovery has reconciled it, instead of guessing or sending again.
 */
export function journalEntries(): Promise<JournalEntry[]> {
  return journal.list();
}

export interface Recovered {
  chainId: ChainId;
  from: Address;
  action: string;
  outcome: Exclude<Reconciled, { kind: "pending" }>;
}

/**
 * One TxRecovery pass over the journal (S8.24, D-179). Each non-terminal entry older than a live send's watch is
 * reconciled on ITS chain (`reconcileEntry`, never a broadcast); an abandoned one resyncs that chain's nonce
 * counter. Settled entries past SETTLED_KEEP_MS are removed. Returns what changed and how many still wait.
 */
export async function recoverJournal(now = Date.now()): Promise<{ recovered: Recovered[]; waiting: number }> {
  const recovered: Recovered[] = [];
  let waiting = 0;
  for (const entry of await journal.list()) {
    if (isTerminalStage(entry.stage)) {
      if (now - entry.updatedAt > SETTLED_KEEP_MS) await journal.remove(entry.hash);
      continue;
    }
    if (!isChainId(entry.chainId)) {
      await journal.remove(entry.hash);
      continue;
    }
    if (now - entry.updatedAt < RECOVERY_MIN_AGE_MS) {
      waiting += 1;
      continue;
    }
    const chainId = entry.chainId;
    const outcome = await reconcileEntry(sharedRead(chainId), entry, now).catch(
      (): Reconciled => ({ kind: "pending" }),
    );
    if (outcome.kind === "pending") {
      waiting += 1;
      continue;
    }
    if (outcome.kind === "settled") {
      await journal.update(entry.hash, {
        stage: outcome.stage,
        blockNumber: outcome.receipt.blockNumber.toString(),
        blockHash: outcome.receipt.blockHash,
      });
    } else {
      await journal.update(entry.hash, { stage: "abandoned", error: outcome.reason });
      sharedNonces(chainId).resync(entry.from);
    }
    const operationLookup = entry.meta?.operationId ?? entry.meta?.operationKey;
    const operation = operationLookup ? readOperation(operationLookup) : undefined;
    if (operation && operation.chainId === chainId && operation.account === entry.from.toLowerCase()) {
      const steps = operation.steps.map((step, index) =>
        step.hash !== entry.hash &&
        !(step.hash === undefined && index === Number(entry.meta?.step) && step.action === entry.action)
          ? step
          : outcome.kind === "settled"
            ? {
                ...step,
                hash: entry.hash,
                outcome: outcome.stage === "finalized" ? ("completed" as const) : ("reverted" as const),
                blockNumber: outcome.receipt.blockNumber.toString(),
                blockHash: outcome.receipt.blockHash,
                facts: receiptFacts(outcome.receipt, chainId, entry.to),
              }
            : { ...step, outcome: "abandoned" as const },
      );
      writeOperation(
        { ...operation, updatedAt: now, steps, outcome: operationOutcome(steps, operation.plannedActions) },
        false,
      );
    }
    recovered.push({ chainId, from: entry.from, action: String(entry.action), outcome });
  }
  return { recovered, waiting };
}
