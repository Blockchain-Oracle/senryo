import { getAddress } from "@senryo/chain";
import { bytes32Of } from "./amounts.ts";
import { USD6_PER_CENT } from "./constants.ts";
import type { CardContext } from "./context.ts";
import type { CardTransactionWebhook, TransactionEvent } from "./lithic/schemas.ts";
import { enqueue } from "./outbox.ts";

/**
 * Lithic lifecycle (docs.lithic.com transaction-flow; events arrive on `card_transaction.updated`, amounts in cents):
 *   CLEARING               → captureHold(holdId, cleared)        (release-only issuer: the contract releases)
 *   AUTHORIZATION_REVERSAL → releaseHold when nothing remains, else lower the expected capture
 *   AUTHORIZATION_EXPIRY   → releaseHold
 *   AUTHORIZATION_ADVICE   → increaseHold(delta) when the new total exceeds the hold (totals, not deltas)
 *   RETURN                 → refund(user, keccak(event token), amount)  (skipped in release-only mode: nothing captured)
 * Each event token is processed once (`card_events` PK); each action once (`outbox.dedupe_key`).
 */
export async function handleTransactionWebhook(ctx: CardContext, webhook: CardTransactionWebhook): Promise<number> {
  if (webhook.event_type !== "card_transaction.updated") return 0;
  const issuer = ctx.env.CARD_ISSUER_LABEL;
  const [hold] = await ctx.db<
    { hold_id: string; account: string; amount_usd6: bigint; expected_usd6: bigint | null }[]
  >`
    SELECT hold_id, account, amount_usd6, expected_usd6 FROM holds WHERE issuer = ${issuer} AND txn_token = ${webhook.token}`;
  let queued = 0;
  for (const event of webhook.events) {
    // One transaction per event (S8.5b #11): the dedupe row, the outbox action and processed_at land together, so a
    // failure mid-way rolls the dedupe row back and Lithic's retry is processed instead of skipped as a duplicate.
    queued += await ctx.db.begin(async (tx) => {
      const fresh = await tx`
        INSERT INTO card_events (event_token, issuer, txn_token, type, amount_cents, payload)
        VALUES (${event.token}, ${issuer}, ${webhook.token}, ${event.type}, ${centsOf(event)},
                ${tx.json(event as never)})
        ON CONFLICT (event_token) DO NOTHING RETURNING event_token`;
      if (fresh.length === 0) return 0;
      const n = await route({ ...ctx, db: tx as unknown as CardContext["db"] }, event, hold, webhook);
      await tx`UPDATE card_events SET processed_at = now() WHERE event_token = ${event.token}`;
      return n;
    });
  }
  return queued;
}

function centsOf(event: TransactionEvent): bigint {
  const cents = event.amounts?.cardholder.amount ?? event.amount ?? 0;
  return BigInt(Math.abs(cents));
}

async function route(
  ctx: CardContext,
  event: TransactionEvent,
  hold: { hold_id: string; account: string; amount_usd6: bigint; expected_usd6: bigint | null } | undefined,
  webhook: CardTransactionWebhook,
): Promise<number> {
  const usd6 = centsOf(event) * USD6_PER_CENT;
  const key = `${event.type}:${event.token}`;
  if (event.type === "RETURN") {
    if (ctx.env.CARD_RELEASE_ONLY) return 0;
    const account = hold?.account ?? (await cardAccount(ctx, webhook.card_token));
    if (!account) return 0;
    await enqueue(ctx.db, ctx.chainId, "refund", key, {
      account: getAddress(account),
      refId: bytes32Of(`refund:${event.token}`),
      amountUsd6: usd6.toString(),
    });
    return 1;
  }
  if (!hold) return 0;
  const base = { holdId: hold.hold_id as `0x${string}`, account: hold.account };
  switch (event.type) {
    case "CLEARING":
      await enqueue(ctx.db, ctx.chainId, "captureHold", key, { ...base, amountUsd6: usd6.toString() });
      return 1;
    case "AUTHORIZATION_EXPIRY":
      await enqueue(ctx.db, ctx.chainId, "releaseHold", key, base);
      return 1;
    case "AUTHORIZATION_REVERSAL": {
      const remaining = (hold.expected_usd6 ?? hold.amount_usd6) - usd6;
      if (remaining <= 0n) {
        await enqueue(ctx.db, ctx.chainId, "releaseHold", key, base);
        return 1;
      }
      await ctx.db`UPDATE holds SET expected_usd6 = ${remaining}, updated_at = now() WHERE hold_id = ${hold.hold_id}`;
      return 0;
    }
    case "AUTHORIZATION_ADVICE": {
      if (usd6 > hold.amount_usd6) {
        const delta = usd6 - hold.amount_usd6;
        await enqueue(ctx.db, ctx.chainId, "increaseHold", key, { ...base, amountUsd6: delta.toString() });
      }
      await ctx.db`UPDATE holds SET expected_usd6 = ${usd6}, updated_at = now() WHERE hold_id = ${hold.hold_id}`;
      return usd6 > hold.amount_usd6 ? 1 : 0;
    }
    default:
      return 0;
  }
}

async function cardAccount(ctx: CardContext, cardToken: string | undefined): Promise<string | undefined> {
  if (!cardToken) return undefined;
  const [row] = await ctx.db<{ account: string }[]>`SELECT account FROM cards WHERE card_token = ${cardToken}`;
  return row?.account;
}
