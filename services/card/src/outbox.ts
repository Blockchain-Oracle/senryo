import {
  type Address,
  contractCall,
  describeError,
  getAddress,
  type Hex,
  readHolds,
  sendAndFinalize,
} from "@senryo/chain";
import { type Db, MS_PER_SECOND } from "@senryo/service-common";
import { OUTBOX } from "./constants.ts";
import { type CardContext, operatorFor } from "./context.ts";
import { books, post } from "./ledger.ts";
import { notifyCaptured, notifyRefunded } from "./notify.ts";

/**
 * Outbox (specs/services.md §card 6): card lifecycle writes are rows first, sends second, so a crash never loses one
 * and a Lithic retry never doubles one (UNIQUE dedupe_key). The worker re-reads the hold onchain before each send
 * (reconciliation against the chain; Envio `HoldPlaced/HoldCaptured` is display-only) and confirms at `finalized`.
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

interface Row {
  id: bigint;
  kind: OutboxKind;
  payload: OutboxPayload;
  attempts: number;
}

type Outcome = { status: "DONE" | "SKIPPED"; tx?: Hex } | { status: "RETRY"; error: string };

/** Claim due rows (SKIP LOCKED) and run them; stuck SENDING rows (crash) go back to PENDING after 5 min. */
export function startOutbox(ctx: CardContext): () => void {
  let stopped = false;
  const tick = async () => {
    // Only this network's rows: every chain's card service shares the table.
    await ctx.db`UPDATE outbox SET status = 'PENDING'
                  WHERE chain_id = ${ctx.chainId} AND status = 'SENDING' AND updated_at < now() - interval '5 minutes'`;
    const rows = await ctx.db<Row[]>`
      UPDATE outbox SET status = 'SENDING', attempts = attempts + 1, updated_at = now()
       WHERE id IN (SELECT id FROM outbox WHERE chain_id = ${ctx.chainId} AND status = 'PENDING'
                      AND next_attempt_at <= now() ORDER BY id LIMIT ${OUTBOX.batch} FOR UPDATE SKIP LOCKED)
      RETURNING id, kind, payload, attempts`;
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

async function execute(ctx: CardContext, row: Row): Promise<Outcome> {
  const { payload } = row;
  const account = getAddress(payload.account);
  const operator = operatorFor(ctx, account);
  if (row.kind === "refund") {
    const amount = BigInt(payload.amountUsd6 ?? "0");
    if (!payload.refId || amount === 0n) return { status: "SKIPPED" };
    const sent = await sendAndFinalize(
      operator,
      contractCall(ctx.chainId, "SenryoCore", "refund", [account, payload.refId, amount], "refund"),
    );
    if (sent.final.stage !== "finalized") return { status: "RETRY", error: `refund ${sent.final.stage}` };
    await post(ctx.db, ctx.chainId, "refund", payload.refId, [[books.cardFloat, books.free(account), amount]]);
    await notifyRefunded(ctx, payload.refId, account, amount, payload);
    return { status: "DONE", tx: sent.hash };
  }
  if (!payload.holdId) return { status: "SKIPPED" };
  const [hold] = await readHolds(ctx.read, ctx.chainId, [payload.holdId]);
  if (!hold || hold.state === "NONE") {
    // Not landed (yet). A declined hold that never lands is skipped once its send is definitely over.
    const [local] = await ctx.db<{ status: string }[]>`SELECT status FROM holds WHERE hold_id = ${payload.holdId}`;
    return local?.status === "FAILED" ? { status: "SKIPPED" } : { status: "RETRY", error: "hold not onchain yet" };
  }
  if (hold.state !== "OPEN") return { status: "SKIPPED" };
  const amount = BigInt(payload.amountUsd6 ?? "0");
  const request =
    row.kind === "captureHold"
      ? contractCall(ctx.chainId, "SenryoCore", "captureHold", [payload.holdId, amount], "captureHold")
      : row.kind === "increaseHold"
        ? contractCall(ctx.chainId, "SenryoCore", "increaseHold", [payload.holdId, amount], "increaseHold")
        : contractCall(ctx.chainId, "SenryoCore", "releaseHold", [payload.holdId], "releaseHold");
  const sent = await sendAndFinalize(operator, request);
  if (sent.final.stage !== "finalized") return { status: "RETRY", error: `${row.kind} ${sent.final.stage}` };
  await settleLedger(ctx, row.kind, payload.holdId, account, hold.amount, amount);
  return { status: "DONE", tx: sent.hash };
}

async function settleLedger(
  ctx: CardContext,
  kind: OutboxKind,
  holdId: Hex,
  account: Address,
  held: bigint,
  amount: bigint,
) {
  if (kind === "increaseHold") {
    await ctx.db`UPDATE holds SET amount_usd6 = amount_usd6 + ${amount}, updated_at = now() WHERE hold_id = ${holdId}`;
    await post(ctx.db, ctx.chainId, "hold-increase", holdId, [[books.free(account), books.held(account), amount]]);
    return;
  }
  const releaseOnly = ctx.env.CARD_RELEASE_ONLY;
  const captured = kind === "captureHold" && !releaseOnly ? (amount < held ? amount : held) : 0n;
  await ctx.db`UPDATE holds SET status = ${captured > 0n ? "CAPTURED" : "RELEASED"}, captured_usd6 = ${captured},
                 updated_at = now() WHERE hold_id = ${holdId}`;
  await post(ctx.db, ctx.chainId, kind, holdId, [
    [books.held(account), books.cardFloat, captured],
    [books.held(account), books.free(account), held - captured],
  ]);
  // The charge as settled (an over-capture above the hold is charged too, up to +20 %; the push says the amount).
  if (kind === "captureHold" && !releaseOnly) await notifyCaptured(ctx, holdId, account, amount);
}
