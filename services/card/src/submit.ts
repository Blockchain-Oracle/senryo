import {
  type Address,
  confirmFinalized,
  contractCall,
  describeError,
  type Hex,
  receiptEvents,
  sendTx,
} from "@senryo/chain";
import { positionGasLimit } from "@senryo/config";
import { type CardContext, operatorFor } from "./context.ts";
import { books, post } from "./ledger.ts";

/**
 * Submit `placeHold` from the account's operator shard with the pre-calibrated explicit gas (no estimate round trip
 * on the hot path; the Postgres reserve already checked the balance) and follow it to `finalized`. The ledger row
 * moves RESERVED → SUBMITTED → ONCHAIN → FINALIZED (or FAILED); `landed_nonce` (from `HoldPlaced`) tells later
 * reserves whether a finalized snapshot already reflects this hold.
 */
export type SubmitResult =
  | { stage: "finalized"; hash: Hex; fromEnvelope: boolean }
  | { stage: "failed"; hash: Hex | undefined; reason: string };

export interface HoldSubmit {
  holdId: Hex;
  txnToken: Hex;
  account: Address;
  amount: bigint;
  /** Open positions on the account (the risk pass re-reads each market — D-185 scales the fixed limit). */
  positions: number;
  /** Proposed-stage callback (the decision may approve on an envelope hold before finality). */
  onProposed?: (info: { hash: Hex; fromEnvelope: boolean }) => void;
}

export async function submitHold(ctx: CardContext, hold: HoldSubmit): Promise<SubmitResult> {
  const operator = operatorFor(ctx, hold.account);
  const request = contractCall(
    ctx.chainId,
    "SenryoCore",
    "placeHold",
    [ctx.issuer, hold.txnToken, hold.account, hold.amount],
    "placeHold",
    { fixedGas: positionGasLimit("placeHold", hold.positions), meta: { holdId: hold.holdId } },
  );
  await ctx.db`UPDATE holds SET status = 'SUBMITTED', operator = ${operator.account.address}, updated_at = now()
                WHERE hold_id = ${hold.holdId}`;
  let hash: Hex | undefined;
  try {
    const sent = await sendTx(operator, request);
    hash = sent.hash;
    if (sent.stage === "reverted") return await fail(ctx, hold.holdId, hash, "placeHold reverted onchain");
    const placed = receiptEvents(sent.receipt, "SenryoCore").find((e) => e.eventName === "HoldPlaced");
    const args = placed?.eventName === "HoldPlaced" ? placed.args : undefined;
    const fromEnvelope = args?.fromEnvelope ?? false;
    await ctx.db`UPDATE holds SET status = 'ONCHAIN', tx_hash = ${hash}, block_number = ${sent.receipt.blockNumber},
                   landed_nonce = ${args ? BigInt(args.nonce) : null}, from_envelope = ${fromEnvelope}, updated_at = now()
                  WHERE hold_id = ${hold.holdId}`;
    hold.onProposed?.({ hash, fromEnvelope });
    const final = await confirmFinalized({ read: ctx.read, heads: operator.heads }, sent.receipt);
    if (final.stage !== "finalized") return await fail(ctx, hold.holdId, hash, `placeHold ${final.stage}`);
    await ctx.db.begin(async (tx) => {
      await tx`UPDATE holds SET status = 'FINALIZED', updated_at = now() WHERE hold_id = ${hold.holdId}`;
      await post(tx, ctx.chainId, "hold", hold.holdId, [
        [books.free(hold.account), books.held(hold.account), hold.amount],
      ]);
    });
    return { stage: "finalized", hash, fromEnvelope };
  } catch (error) {
    return fail(ctx, hold.holdId, hash, describeError(error));
  }
}

async function fail(ctx: CardContext, holdId: Hex, hash: Hex | undefined, reason: string): Promise<SubmitResult> {
  // An unknown outcome (broadcast/finality timeout) stays SUBMITTED/ONCHAIN — still counted as pending — and the
  // outbox `releaseIfLanded` row cleans it up; only a definite failure is FAILED.
  const definite = reason.includes("reverted") || reason.includes("would revert");
  await ctx.db`UPDATE holds SET status = CASE WHEN ${definite} THEN 'FAILED' ELSE status END,
                 last_error = ${reason}, tx_hash = COALESCE(tx_hash, ${hash ?? null}), updated_at = now()
                WHERE hold_id = ${holdId}`;
  ctx.log.warn({ holdId, tx: hash, reason }, "placeHold did not settle");
  return { stage: "failed", hash, reason };
}
