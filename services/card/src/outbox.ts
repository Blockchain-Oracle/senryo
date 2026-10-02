import {
  type Address,
  contractCall,
  describeError,
  getAddress,
  type Hex,
  type JournalEntry,
  readContract,
  readHolds,
  reconcileEntry,
  type Sender,
  sendAndFinalize,
  type TransactionReceipt,
  type TxJournal,
} from "@senryo/chain";
import { type Db, MS_PER_SECOND } from "@senryo/service-common";
import { OUTBOX } from "./constants.ts";
import { type CardContext, operatorFor } from "./context.ts";
import { notifyCaptured, notifyRefunded } from "./notify.ts";
import { effectOf, settleCapture, settleIncrease, settleRefund, settleRelease } from "./settle.ts";

/**
 * Outbox (specs/services.md §card 6): card lifecycle writes are rows first, sends second, so a crash never loses one
 * and a Lithic retry never doubles one (UNIQUE dedupe_key). Each send is recorded on its row when the operator signs
 * it, before the broadcast (`tx_hash`, `tx_from`, `tx_nonce`). A row runs again only after that transaction is
 * reconciled (TxRecovery rules, D-179): finalized → settle from its receipt; still pending → wait; abandoned or
 * reverted → decide afresh from the chain. So a write that fails after an onchain capture or refund is finished on the
 * retry, and the call is never sent twice. Settlement (hold row, ledger, push) reads the receipt's events.
 */
export type OutboxKind = "releaseIfLanded" | "releaseHold" | "captureHold" | "increaseHold" | "refund";

export interface OutboxPayload {
  holdId?: Hex;
  account: Address | string;
  amountUsd6?: string;
  refId?: Hex;
  /** Refunds: the issuer transaction and merchant, so the push can name them. */
  txnToken?: string;
  merchant?: string;
}

export async function enqueue(db: Db, chainId: number, kind: OutboxKind, dedupeKey: string, payload: OutboxPayload) {
  await db`INSERT INTO outbox (chain_id, kind, dedupe_key, payload)
           VALUES (${chainId}, ${kind}, ${dedupeKey}, ${db.json(payload as never)}) ON CONFLICT (dedupe_key) DO NOTHING`;
}

/** A transaction a row signed (recorded before its broadcast). */
interface SentRef {
  hash: Hex;
  from: string;
  nonce: number;
}

interface Row {
  id: bigint;
  kind: OutboxKind;
  payload: OutboxPayload;
  attempts: number;
  txs: SentRef[];
}

type Outcome = { status: "DONE" | "SKIPPED"; tx?: Hex } | { status: "RETRY"; error: string };

/**
 * Claim due rows (SKIP LOCKED) and run them. Stuck SENDING rows (a crash mid-send) go back to PENDING after 5 min —
 * only this network's: every chain's card service shares the table.
 */
export function startOutbox(ctx: CardContext): () => void {
  let stopped = false;
  const tick = async () => {
    await ctx.db`UPDATE outbox SET status = 'PENDING'
                  WHERE chain_id = ${ctx.chainId} AND status = 'SENDING' AND updated_at < now() - interval '5 minutes'`;
    const rows = await ctx.db<Row[]>`
      UPDATE outbox SET status = 'SENDING', attempts = attempts + 1, updated_at = now()
       WHERE id IN (SELECT id FROM outbox WHERE chain_id = ${ctx.chainId} AND status = 'PENDING'
                      AND next_attempt_at <= now() ORDER BY id LIMIT ${OUTBOX.batch} FOR UPDATE SKIP LOCKED)
      RETURNING id, kind, payload, attempts, txs`;
    await Promise.all(rows.map((row) => runRow(ctx, row)));
  };
  const loop = async () => {
    while (!stopped) {
      await tick().catch((error) => ctx.log.warn({ err: describeError(error) }, "outbox tick failed"));
      await new Promise((resolve) => setTimeout(resolve, OUTBOX.pollMs));
    }
  };
  void loop();
  return () => {
    stopped = true;
  };
}

async function runRow(ctx: CardContext, row: Row): Promise<void> {
  let outcome: Outcome;
  try {
    outcome = await execute(ctx, row);
  } catch (error) {
    outcome = { status: "RETRY", error: describeError(error) };
  }
  if (outcome.status === "RETRY") {
    const failed = row.attempts >= OUTBOX.maxAttempts;
    const backoffMs = OUTBOX.backoffBaseMs * 2 ** Math.min(row.attempts, OUTBOX.maxAttempts);
    await ctx.db`UPDATE outbox SET status = ${failed ? "FAILED" : "PENDING"}, last_error = ${outcome.error},
                   next_attempt_at = now() + make_interval(secs => ${backoffMs / MS_PER_SECOND}), updated_at = now()
                  WHERE id = ${row.id}`;
    ctx.log.warn({ outbox: row.kind, id: row.id.toString(), err: outcome.error, failed }, "outbox retry");
    return;
  }
  await ctx.db`UPDATE outbox SET status = ${outcome.status}, tx_hash = ${outcome.tx ?? null}, updated_at = now()
                WHERE id = ${row.id}`;
  ctx.log.info({ outbox: row.kind, id: row.id.toString(), status: outcome.status, tx: outcome.tx }, "outbox row done");
}

/** The operator, with a journal that records each signed tx on this row before it is broadcast. */
function rowSender(ctx: CardContext, row: Row, operator: Sender): Sender {
  const inner = operator.journal;
  const journal: TxJournal = {
    put: async (entry) => {
      const sent: SentRef = { hash: entry.hash, from: entry.from.toLowerCase(), nonce: entry.nonce };
      await ctx.db`UPDATE outbox SET tx_hash = ${entry.hash}, txs = txs || ${ctx.db.json([sent] as never)}::jsonb,
                     updated_at = now() WHERE id = ${row.id}`;
      await inner?.put(entry);
    },
    update: async (hash, patch) => inner?.update(hash, patch),
    list: async () => (inner ? inner.list() : []),
    remove: async (hash) => inner?.remove(hash),
  };
  return { ...operator, journal };
}

/** Kinds the contract refuses to apply twice (HoldNotOpen, RefundUsed); `increaseHold` is not one of them. */
const ONCE_ONCHAIN: ReadonlySet<OutboxKind> = new Set(["captureHold", "releaseHold", "releaseIfLanded", "refund"]);

type TxState = { state: "finalized"; receipt: TransactionReceipt } | { state: "pending" } | { state: "gone" };

/**
 * What became of one recorded send (chain `reconcileEntry`: never rebroadcast; the nonce decides). A send no node
 * has seen (its broadcast failed) counts as gone for calls the contract applies once — if it surfaces later, the
 * history settles from it and the newer call reverts — and as pending for `increaseHold`.
 */
async function txState(ctx: CardContext, sent: SentRef, kind: OutboxKind): Promise<TxState> {
  const from = getAddress(sent.from);
  // reconcileEntry reads only the hash, the sender and the nonce.
  const entry: JournalEntry = {
    hash: sent.hash,
    chainId: ctx.chainId,
    from,
    to: from,
    nonce: sent.nonce,
    gas: "0",
    action: "outbox",
    raw: "0x",
    stage: "submitted",
    createdAt: 0,
    updatedAt: 0,
  };
  const found = await reconcileEntry(ctx.read, entry);
  if (found.kind === "settled")
    return found.stage === "finalized" ? { state: "finalized", receipt: found.receipt } : { state: "gone" };
  if (found.kind === "abandoned") return { state: "gone" };
  if (!ONCE_ONCHAIN.has(kind)) return { state: "pending" };
  const known = await ctx.read.getTransaction({ hash: sent.hash }).then(
    () => true,
    () => false,
  );
  return known ? { state: "pending" } : { state: "gone" };
}

type Prior = { kind: "none" } | { kind: "pending"; hash: Hex } | { kind: "finalized"; receipt: TransactionReceipt };

/** The row's sends, newest first: one finalized settles the row; one pending makes it wait; else decide afresh. */
async function priorOf(ctx: CardContext, txs: readonly SentRef[], kind: OutboxKind): Promise<Prior> {
  let pending: Hex | undefined;
  for (const sent of [...txs].reverse()) {
    const found = await txState(ctx, sent, kind);
    if (found.state === "finalized") return { kind: "finalized", receipt: found.receipt };
    if (found.state === "pending") pending ??= sent.hash;
  }
  return pending ? { kind: "pending", hash: pending } : { kind: "none" };
}

async function execute(ctx: CardContext, row: Row): Promise<Outcome> {
  const prior = await priorOf(ctx, row.txs, row.kind);
  if (prior.kind === "pending") return { status: "RETRY", error: `previous send ${prior.hash} not final yet` };
  if (prior.kind === "finalized") return settleFrom(ctx, row, prior.receipt);
  return row.kind === "refund" ? freshRefund(ctx, row) : freshHold(ctx, row);
}

/** Finish a row from its finalized transaction: hold row, ledger and push from the receipt's events. */
async function settleFrom(ctx: CardContext, row: Row, receipt: TransactionReceipt): Promise<Outcome> {
  const { payload } = row;
  const account = getAddress(payload.account);
  const ref = row.kind === "refund" ? payload.refId : payload.holdId;
  const effect = ref ? effectOf(receipt, ref) : undefined;
  if (!ref || !effect) return { status: "RETRY", error: `receipt ${receipt.transactionHash} has no event for ${ref}` };
  const tx = receipt.transactionHash;
  switch (effect.kind) {
    case "refunded":
      await settleRefund(ctx, ref, account, effect);
      await notifyRefunded(ctx, ref, account, effect.amount, payload);
      return { status: "DONE", tx };
    case "captured": {
      // The hold's onchain amount (unchanged by the capture) splits the charge into hold part and over-capture.
      const [hold] = await readHolds(ctx.read, ctx.chainId, [ref]);
      if (!hold) return { status: "RETRY", error: `hold ${ref} unreadable` };
      await settleCapture(ctx, ref, account, hold.amount, effect);
      await notifyCaptured(ctx, ref, account, effect.captured, effect.debt);
      return { status: "DONE", tx };
    }
    case "released":
      await settleRelease(ctx, ref, account, effect.amount);
      return { status: "DONE", tx };
    case "increased":
      await settleIncrease(ctx, ref, account, tx, effect);
      return { status: "DONE", tx };
  }
}

async function sendRow(ctx: CardContext, row: Row, account: Address, request: ReturnType<typeof contractCall>) {
  const sent = await sendAndFinalize(rowSender(ctx, row, operatorFor(ctx, account)), request);
  if (sent.final.stage !== "finalized") return { status: "RETRY", error: `${row.kind} ${sent.final.stage}` } as Outcome;
  return settleFrom(ctx, row, sent.final.receipt);
}

/**
 * A refund is sent only when the chain shows it unused. `refundUsed[refId]` set without a send of ours on record can
 * only be someone else's call: never send a second one — the contract would revert it (`RefundUsed`), and the row
 * needs a person.
 */
async function freshRefund(ctx: CardContext, row: Row): Promise<Outcome> {
  const { payload } = row;
  const account = getAddress(payload.account);
  const amount = BigInt(payload.amountUsd6 ?? "0");
  if (!payload.refId || amount === 0n) return { status: "SKIPPED" };
  const used = await readContract(ctx.chainId, "SenryoCore", ctx.read).read.refundUsed([payload.refId]);
  if (used) {
    ctx.log.error({ refId: payload.refId, row: row.id.toString() }, "refund already used onchain by another send");
    return { status: "SKIPPED" };
  }
  const request = contractCall(ctx.chainId, "SenryoCore", "refund", [account, payload.refId, amount], "refund");
  return sendRow(ctx, row, account, request);
}

/** Captures, increases and releases: decided from the hold's onchain state. */
async function freshHold(ctx: CardContext, row: Row): Promise<Outcome> {
  const { payload } = row;
  if (!payload.holdId) return { status: "SKIPPED" };
  const account = getAddress(payload.account);
  const [hold] = await readHolds(ctx.read, ctx.chainId, [payload.holdId]);
  if (!hold || hold.state === "NONE") {
    // Not landed (yet). A declined hold that never lands is skipped once its send is definitely over.
    const [local] = await ctx.db<{ status: string }[]>`SELECT status FROM holds WHERE hold_id = ${payload.holdId}`;
    return local?.status === "FAILED" ? { status: "SKIPPED" } : { status: "RETRY", error: "hold not onchain yet" };
  }
  if (hold.state === "RELEASED") {
    // Released by another call (operator, release-only capture, anyone after expiry): exact without its receipt.
    await settleRelease(ctx, payload.holdId, account, hold.amount);
    return { status: "SKIPPED" };
  }
  if (hold.state === "CAPTURED") return settleSiblingCapture(ctx, row, payload.holdId);
  if (hold.state !== "OPEN") return { status: "SKIPPED" };
  const amount = BigInt(payload.amountUsd6 ?? "0");
  const request =
    row.kind === "captureHold"
      ? contractCall(ctx.chainId, "SenryoCore", "captureHold", [payload.holdId, amount], "captureHold")
      : row.kind === "increaseHold"
        ? contractCall(ctx.chainId, "SenryoCore", "increaseHold", [payload.holdId, amount], "increaseHold")
        : contractCall(ctx.chainId, "SenryoCore", "releaseHold", [payload.holdId], "releaseHold");
  return sendRow(ctx, row, account, request);
}

/**
 * The hold is CAPTURED by another row's call (a second CLEARING for the same hold, or a capture row that ran out of
 * retries): settle from that row's recorded transaction, so the hold never stays counted as open.
 */
async function settleSiblingCapture(ctx: CardContext, row: Row, holdId: Hex): Promise<Outcome> {
  const siblings = await ctx.db<Row[]>`
    SELECT id, kind, payload, attempts, txs FROM outbox
     WHERE chain_id = ${ctx.chainId} AND kind = 'captureHold' AND id <> ${row.id}
       AND payload->>'holdId' = ${holdId} AND jsonb_array_length(txs) > 0`;
  for (const sibling of siblings) {
    const prior = await priorOf(ctx, sibling.txs, sibling.kind);
    if (prior.kind === "finalized" && effectOf(prior.receipt, holdId)?.kind === "captured") {
      await settleFrom(ctx, sibling, prior.receipt);
      return { status: "SKIPPED" };
    }
  }
  return { status: "SKIPPED" };
}
