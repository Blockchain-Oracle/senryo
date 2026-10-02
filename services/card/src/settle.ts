import { type Hex, receiptEvents, type TransactionReceipt } from "@senryo/chain";
import type { CardContext } from "./context.ts";
import { books, type Posting, postOnce } from "./ledger.ts";
import { OPEN_HOLD_STATUSES } from "./reserve.ts";

/**
 * Settlement of finalized card calls, from what the chain says happened (the receipt's events), never from what was
 * asked for. Each settle is one Postgres transaction and idempotent: the hold row moves only out of an open status
 * and the ledger books once per reference, so a retried outbox row (a write that failed after the call finalized)
 * settles exactly once.
 */

/** A finalized call's effect on one hold or refund (usd6). */
export type CardEffect =
  | { kind: "captured"; captured: bigint; released: bigint; debt: bigint }
  | { kind: "released"; amount: bigint }
  | { kind: "increased"; delta: bigint; total: bigint }
  | { kind: "refunded"; amount: bigint; debtRepaid: bigint };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The SenryoCore event in `receipt` for this hold (`ref` = holdId) or refund (`ref` = refId). */
export function effectOf(receipt: TransactionReceipt, ref: Hex): CardEffect | undefined {
  for (const e of receiptEvents(receipt, "SenryoCore")) {
    if (e.eventName === "HoldCaptured" && same(e.args.holdId, ref))
      return { kind: "captured", captured: e.args.captured, released: e.args.released, debt: e.args.debtCreated };
    if (e.eventName === "HoldReleased" && same(e.args.holdId, ref)) return { kind: "released", amount: e.args.amount };
    if (e.eventName === "HoldIncreased" && same(e.args.holdId, ref))
      return { kind: "increased", delta: e.args.delta, total: e.args.amount };
    if (e.eventName === "CardRefunded" && same(e.args.refId, ref))
      return { kind: "refunded", amount: e.args.amount, debtRepaid: e.args.debtRepaid };
  }
  return undefined;
}

/**
 * Capture postings (CardModule.captureHold): the hold part (≤ the hold) leaves `held`, the remainder returns to
 * `free`, an over-capture is paid from `free`, and whatever the collateral couldn't pay is card debt. `held` is the
 * hold's onchain amount; the postings balance to `captured` into the card float.
 */
export function capturePostings(
  account: string,
  held: bigint,
  f: { captured: bigint; released: bigint; debt: bigint },
) {
  const holdPart = held - f.released;
  const excess = f.captured > holdPart ? f.captured - holdPart : 0n;
  // Debt normally comes from the over-capture; only a broken reserve (balance below the hold) puts it in the hold part.
  const debtFromHold = f.debt > excess ? f.debt - excess : 0n;
  const debtFromExcess = f.debt - debtFromHold;
  const postings: Posting[] = [
    [books.held(account), books.free(account), f.released + debtFromHold],
    [books.held(account), books.cardFloat, holdPart - debtFromHold],
    [books.free(account), books.cardFloat, excess - debtFromExcess],
    [books.debt(account), books.cardFloat, f.debt],
  ];
  return postings;
}

/** CAPTURED with the full captured amount and the debt it created. True when this call moved the row. */
export async function settleCapture(
  ctx: CardContext,
  holdId: Hex,
  account: string,
  held: bigint,
  f: { captured: bigint; released: bigint; debt: bigint },
): Promise<boolean> {
  return ctx.db.begin(async (tx) => {
    const moved = await tx`
      UPDATE holds SET status = 'CAPTURED', amount_usd6 = ${held}, captured_usd6 = ${f.captured},
                       debt_usd6 = ${f.debt}, updated_at = now()
       WHERE hold_id = ${holdId} AND status IN ${tx(OPEN_HOLD_STATUSES)} RETURNING hold_id`;
    if (moved.length > 0) await postOnce(tx, ctx.chainId, "captureHold", holdId, capturePostings(account, held, f));
    return moved.length > 0;
  });
}

/** RELEASED (operator release, release-only capture, expiry): the whole hold returns to free. */
export async function settleRelease(ctx: CardContext, holdId: Hex, account: string, amount: bigint): Promise<boolean> {
  return ctx.db.begin(async (tx) => {
    const moved = await tx`
      UPDATE holds SET status = 'RELEASED', captured_usd6 = 0, updated_at = now()
       WHERE hold_id = ${holdId} AND status IN ${tx(OPEN_HOLD_STATUSES)} RETURNING hold_id`;
    if (moved.length > 0)
      await postOnce(tx, ctx.chainId, "releaseHold", holdId, [[books.held(account), books.free(account), amount]]);
    return moved.length > 0;
  });
}

/** An incremental authorisation landed: booked once per transaction (a hold can grow more than once). */
export async function settleIncrease(
  ctx: CardContext,
  holdId: Hex,
  account: string,
  txHash: Hex,
  f: { delta: bigint; total: bigint },
): Promise<boolean> {
  return ctx.db.begin(async (tx) => {
    const booked = await postOnce(tx, ctx.chainId, "hold-increase", `${holdId}:${txHash}`, [
      [books.free(account), books.held(account), f.delta],
    ]);
    if (booked) await tx`UPDATE holds SET amount_usd6 = ${f.total}, updated_at = now() WHERE hold_id = ${holdId}`;
    return booked;
  });
}

/** A merchant refund: card debt is repaid first (`debtRepaid`), the rest returns to free. */
export async function settleRefund(
  ctx: CardContext,
  refId: Hex,
  account: string,
  f: { amount: bigint; debtRepaid: bigint },
): Promise<boolean> {
  return ctx.db.begin((tx) =>
    postOnce(tx, ctx.chainId, "refund", refId, [
      [books.cardFloat, books.debt(account), f.debtRepaid],
      [books.cardFloat, books.free(account), f.amount - f.debtRepaid],
    ]),
  );
}
