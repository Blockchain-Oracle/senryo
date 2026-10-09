/**
 * 0017 — Earn (S7.6, D-287). `earn_owners`: everyone who sent an Earn request through the relay, so the keeper can
 * deliver settled supplies and withdrawals after each hourly roll (claims are lazy on chain; nobody should have to
 * come back and press a button for their dollars).
 */
export const id = "0017_earn";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS earn_owners (
  chain_id int NOT NULL,
  owner text NOT NULL,
  last_request_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  PRIMARY KEY (chain_id, owner)
);
`;
