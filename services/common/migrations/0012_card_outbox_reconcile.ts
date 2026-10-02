/**
 * 0012 — card outbox reconciliation (UI review, card service):
 *  - `outbox.txs` lists every transaction a row signed (`{hash, from, nonce}`), written when the operator signs it,
 *    before the broadcast; `tx_hash` stays the latest. A retried row reconciles those first (one finalized → settle
 *    from its receipt; one pending → wait; all abandoned or reverted → decide afresh), so a write failing after an
 *    onchain capture or refund never leaves the hold open and never sends the call twice.
 *  - `holds.debt_usd6` is the card debt a capture created (`HoldCaptured.debtCreated`); `captured_usd6` now holds the
 *    full captured amount, so the summary, the ledger and the push state the same numbers.
 * 0011 is taken by the social branch. Forward-only, idempotent.
 */
export const id = "0012_card_outbox_reconcile";

export const sql = /* sql */ `
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS txs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE holds ADD COLUMN IF NOT EXISTS debt_usd6 bigint NOT NULL DEFAULT 0 CHECK (debt_usd6 >= 0);
`;
