/**
 * 0001 — card path + double-entry ledger (specs/services.md "Postgres tables"). Forward-only and idempotent:
 * every statement is `IF NOT EXISTS`, so re-running is a no-op. Amounts: usd6 as bigint, wei as numeric(78,0);
 * addresses lower-case hex; hold ids / tx hashes 0x-hex text.
 */
export const id = "0001_card_ledger";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS card_auth (
  id              uuid PRIMARY KEY,
  issuer          text NOT NULL,
  txn_token       text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('AUTH', 'FINANCIAL_AUTH', 'BALANCE_INQUIRY', 'CREDIT_AUTH')),
  chain_id        integer NOT NULL,
  card_token      text NOT NULL,
  account         text,
  amount_cents    bigint NOT NULL,
  currency        text NOT NULL,
  mcc             text,
  hold_usd6       bigint,
  hold_id         text,
  status          text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED')),
  result          text,
  reason          text,
  mode            text,
  received_at     timestamptz NOT NULL DEFAULT now(),
  decided_at      timestamptz,
  deadline_at     timestamptz NOT NULL,
  request         jsonb NOT NULL,
  UNIQUE (issuer, txn_token, kind)
);
CREATE INDEX IF NOT EXISTS card_auth_account_idx ON card_auth (account, received_at DESC);

CREATE TABLE IF NOT EXISTS holds (
  hold_id         text PRIMARY KEY,
  chain_id        integer NOT NULL,
  account         text NOT NULL,
  issuer          text NOT NULL,
  txn_token       text NOT NULL,
  amount_usd6     bigint NOT NULL CHECK (amount_usd6 > 0),
  status          text NOT NULL CHECK (status IN
                    ('RESERVED', 'SUBMITTED', 'ONCHAIN', 'FINALIZED', 'CAPTURED', 'RELEASED', 'FAILED')),
  from_envelope   boolean,
  operator        text,
  tx_hash         text,
  block_number    bigint,
  landed_nonce    bigint,
  captured_usd6   bigint NOT NULL DEFAULT 0,
  expected_usd6   bigint,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS holds_open_idx ON holds (chain_id, account)
  WHERE status IN ('RESERVED', 'SUBMITTED', 'ONCHAIN', 'FINALIZED');

CREATE TABLE IF NOT EXISTS ledger_entries (
  id              bigserial PRIMARY KEY,
  entry_group     uuid NOT NULL,
  chain_id        integer NOT NULL,
  book            text NOT NULL,
  direction       char(1) NOT NULL CHECK (direction IN ('D', 'C')),
  amount_usd6     bigint NOT NULL CHECK (amount_usd6 > 0),
  ref_type        text NOT NULL,
  ref_id          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_group_idx ON ledger_entries (entry_group);
CREATE INDEX IF NOT EXISTS ledger_entries_ref_idx ON ledger_entries (ref_type, ref_id);

CREATE OR REPLACE VIEW ledger_unbalanced AS
  SELECT entry_group,
         sum(CASE WHEN direction = 'D' THEN amount_usd6 ELSE 0 END) AS debits,
         sum(CASE WHEN direction = 'C' THEN amount_usd6 ELSE 0 END) AS credits
    FROM ledger_entries
   GROUP BY entry_group
  HAVING sum(CASE WHEN direction = 'D' THEN amount_usd6 ELSE -amount_usd6 END) <> 0;

CREATE TABLE IF NOT EXISTS outbox (
  id              bigserial PRIMARY KEY,
  chain_id        integer NOT NULL,
  kind            text NOT NULL,
  dedupe_key      text NOT NULL UNIQUE,
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'DONE', 'FAILED', 'SKIPPED')),
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  tx_hash         text,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_due_idx ON outbox (next_attempt_at) WHERE status IN ('PENDING', 'SENDING');

CREATE TABLE IF NOT EXISTS operator_nonces (
  chain_id        integer NOT NULL,
  address         text NOT NULL,
  next_nonce      bigint NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, address)
);

CREATE TABLE IF NOT EXISTS card_events (
  event_token     text PRIMARY KEY,
  issuer          text NOT NULL,
  txn_token       text NOT NULL,
  type            text NOT NULL,
  amount_cents    bigint,
  payload         jsonb NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS card_events_txn_idx ON card_events (issuer, txn_token);

CREATE TABLE IF NOT EXISTS latency_samples (
  id              bigserial PRIMARY KEY,
  service         text NOT NULL,
  flow            text NOT NULL,
  ref_id          text,
  stage           text NOT NULL,
  ms              integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS latency_samples_flow_idx ON latency_samples (flow, stage, created_at DESC);
`;
