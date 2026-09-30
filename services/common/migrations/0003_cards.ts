/**
 * 0003 — issued cards → the Senryo account they spend from. The ASA responder resolves `card.token` here (never via
 * the indexer). Rows are created by the card-setup flow (S10: Lithic card create after the user signs the spend
 * allowance) or by the drive script on a fork. Forward-only, idempotent.
 */
export const id = "0003_cards";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS cards (
  card_token      text PRIMARY KEY,
  issuer          text NOT NULL,
  chain_id        integer NOT NULL,
  account         text NOT NULL,
  state           text NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE', 'PAUSED', 'CLOSED')),
  label           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cards_account_idx ON cards (account);
`;
