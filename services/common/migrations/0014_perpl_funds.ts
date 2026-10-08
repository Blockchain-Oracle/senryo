/**
 * 0014 — Practice Perpl test dollars are relays too (real venues, Stage 1): the sponsor calls Agora's test-AUSD faucet
 * for a signed-in Practice user, recorded, rate-limited and reconciled like a claim. Forward-only, idempotent.
 */
export const id = "0014_perpl_funds";

export const sql = /* sql */ `
ALTER TABLE starter_claims DROP CONSTRAINT IF EXISTS starter_claims_kind_check;
ALTER TABLE starter_claims ADD CONSTRAINT starter_claims_kind_check
  CHECK (kind IN ('claim', 'voucher', 'topup', 'perpl-funds'));
`;
