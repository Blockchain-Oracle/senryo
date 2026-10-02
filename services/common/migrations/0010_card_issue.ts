/**
 * 0010 — card issuance (D3, E1). `POST /v1/card/issue` creates the Lithic card and stores it here:
 *  - `last4` is kept at issue, so the summary never calls the issuer (the sandbox allows ~1 request/s) and never
 *    fetches the PAN-bearing card object to render a list;
 *  - at most one live (non-CLOSED) card per account per network — the index is what makes issuance idempotent
 *    under a race. Older live duplicates (drive/fork rows) are closed first so the index can be built.
 * 0009 is reserved for the D7 notifications migration. Forward-only, idempotent.
 */
export const id = "0010_card_issue";

export const sql = /* sql */ `
ALTER TABLE cards ADD COLUMN IF NOT EXISTS last4 text CHECK (last4 ~ '^[0-9]{4}$');

UPDATE cards c SET state = 'CLOSED', updated_at = now()
 WHERE c.state <> 'CLOSED'
   AND EXISTS (SELECT 1 FROM cards n
                WHERE n.account = c.account AND n.chain_id = c.chain_id AND n.state <> 'CLOSED'
                  AND (n.created_at, n.card_token) > (c.created_at, c.card_token));

CREATE UNIQUE INDEX IF NOT EXISTS cards_one_live_idx ON cards (chain_id, account) WHERE state <> 'CLOSED';
`;
