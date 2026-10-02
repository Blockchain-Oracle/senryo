/**
 * User sends (S6.12 — the seam the trade and money flows call): `@senryo/chain` is the only sender, the Mera scoped signer
 * is its viem `account` (the policy runs before every signature; one prompt when locked), nonces run through
 * `@senryo/account`'s per-address queue around chain's `LocalNonceSource`, and the lifecycle journal lives in
 * localStorage (`kvJournal`) so a reload mid-send reconciles the same signed bytes — read only, never re-broadcast.
 * Import this lazily where possible — chain carries the contract ABIs, which stay out of the landing bundle.
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
  kvJournal,
  LocalNonceSource,
  type NonceSource,
  type ReadClient,
  type Reconciled,
  reconcileEntry,
  type Sender,
} from "@senryo/chain";
import { isChainId } from "@senryo/config";
import { isTerminalStage } from "@senryo/core";
import { userFeeCache } from "@senryo/query";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { policyContext } from "./api";
import { kvStore } from "./local";

let read: ReadClient | undefined;
let nonces: NonceSource | undefined;
const journal = kvJournal(kvStore);

/** A live send watches its own tx for ≤ 27 s; recovery leaves younger entries to it. */
const RECOVERY_MIN_AGE_MS = 30_000;
/** Settled entries stay this long (a pending screen can still read its outcome), then go. */
const SETTLED_KEEP_MS = 86_400_000;

function shared(): { read: ReadClient; nonces: NonceSource } {
  read ??= createReadClient(ACTIVE_NETWORK.chainId);
  nonces ??= queuedNonces(new LocalNonceSource(read));
  return { read, nonces };
}

/** What a trade call site knows that the policy needs: market room, equity, a label for the prompt. */
export type TradeContext = Pick<PolicyContext, "marketRoomUsd6" | "equityUsd6" | "marketLabel">;

/** One sender per call site; the read client, nonce counter, journal and fee quote are shared by the whole tab. */
export function userSender(
  client: AccountClient,
  address: Address,
  faceId: FaceIdMode | undefined,
  trade?: TradeContext,
): Sender {
  const { read, nonces } = shared();
  const base = policyContext(address, faceId);
  return createSender({
    chainId: ACTIVE_NETWORK.chainId,
    account: client.signer(trade ? () => ({ ...base(), ...trade }) : base),
    read,
    nonces,
    journal,
    // The same quote the gas budget uses (D-171): what the ticket checks is exactly what gets signed.
    fees: userFeeCache(read),
  });
}

/**
 * A sender for the one-shot, unscoped signer of a passkey step-up (`account.stepUp`): sends outside the session's scope
 * (to someone else's address, an over-cap trade). Shares the read client, nonces, journal and fee quote, so the send is
 * journalled and recovered like any other; the signer ends when the ceremony's callback returns.
 */
export function stepUpSender(signer: LocalAccount): Sender {
  const { read, nonces } = shared();
  return createSender({
    chainId: ACTIVE_NETWORK.chainId,
    account: signer,
    read,
    nonces,
    journal,
    fees: userFeeCache(read),
  });
}

/** The send journal as it stands: a screen whose live watch lost a signed tx reads its true outcome here. */
export function journalEntries(): Promise<JournalEntry[]> {
  return journal.list();
}

/**
 * One recovery pass over the journal (S8.24): each non-terminal entry older than a live send's watch is reconciled on
 * its chain (`reconcileEntry`, never a broadcast); an abandoned one resyncs the nonce counter. Returns how many wait.
 */
export async function recoverJournal(now = Date.now()): Promise<number> {
  let waiting = 0;
  for (const entry of await journal.list()) {
    if (isTerminalStage(entry.stage)) {
      if (now - entry.updatedAt > SETTLED_KEEP_MS) await journal.remove(entry.hash);
      continue;
    }
    if (!isChainId(entry.chainId) || entry.chainId !== ACTIVE_NETWORK.chainId) continue;
    if (now - entry.updatedAt < RECOVERY_MIN_AGE_MS) {
      waiting += 1;
      continue;
    }
    const outcome = await reconcileEntry(shared().read, entry, now).catch((): Reconciled => ({ kind: "pending" }));
    if (outcome.kind === "pending") {
      waiting += 1;
    } else if (outcome.kind === "settled") {
      await journal.update(entry.hash, {
        stage: outcome.stage,
        blockNumber: outcome.receipt.blockNumber.toString(),
        blockHash: outcome.receipt.blockHash,
      });
    } else {
      await journal.update(entry.hash, { stage: "abandoned", error: outcome.reason });
      shared().nonces.resync(entry.from);
    }
  }
  return waiting;
}
