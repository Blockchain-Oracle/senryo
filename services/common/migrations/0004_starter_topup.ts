/**
 * 0004 — gas top-ups are relays too (S8.16c, D-171): `starter_claims.kind` gains `topup` so every sponsor-sent
 * `StarterDrip.topUp` is recorded, rate-limited and reconciled like a claim. Postgres names an inline column CHECK
 * `<table>_<column>_check`. Forward-only, idempotent.
 */
export const id = "0004_starter_topup";

export const sql = /* sql */ `
ALTER TABLE starter_claims DROP CONSTRAINT IF EXISTS starter_claims_kind_check;
ALTER TABLE starter_claims ADD CONSTRAINT starter_claims_kind_check CHECK (kind IN ('claim', 'voucher', 'topup'));
`;
