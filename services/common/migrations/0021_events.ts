/**
 * 0021 — yes/no events (S8.7, D-296). `market_events` is the keeper's listing of real games (written `listing` before
 * the transaction, then driven by the book's own events) with what the apps show: the teams, the start, the pools.
 * `event_answers` keeps each committee member's full statement beside its hash and signature, so anyone can re-hash
 * what the chain recorded. `event_calls` follows the book's `Called` and `CallPaid` for each caller.
 */
export const id = "0021_events";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS market_events (
  chain_id int NOT NULL,
  event_id text NOT NULL,
  league text NOT NULL,
  game_key text NOT NULL,
  question text NOT NULL,
  rules text NOT NULL,
  terms_hash text NOT NULL,
  home jsonb NOT NULL,
  away jsonb NOT NULL,
  starts_at bigint NOT NULL,
  closes_at bigint NOT NULL,
  answer_from bigint NOT NULL,
  answer_by bigint NOT NULL,
  fee_bps int NOT NULL,
  committee_id int NOT NULL,
  state text NOT NULL CHECK (state IN ('listing', 'open', 'decided', 'voided')),
  yes_pool bigint NOT NULL DEFAULT 0,
  no_pool bigint NOT NULL DEFAULT 0,
  calls int NOT NULL DEFAULT 0,
  answer boolean,
  void_reason text,
  fee bigint,
  prize bigint,
  decided_at timestamptz,
  listed_tx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, event_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS market_events_game ON market_events (chain_id, league, game_key);
CREATE INDEX IF NOT EXISTS market_events_board ON market_events (chain_id, closes_at) WHERE state = 'open';
CREATE INDEX IF NOT EXISTS market_events_recent ON market_events (chain_id, decided_at DESC)
  WHERE state IN ('decided', 'voided');

CREATE TABLE IF NOT EXISTS event_answers (
  chain_id int NOT NULL,
  event_id text NOT NULL,
  member text NOT NULL,
  yes boolean NOT NULL,
  statement text NOT NULL,
  statement_hash text NOT NULL,
  attested_at bigint NOT NULL,
  signature text NOT NULL,
  posted boolean NOT NULL DEFAULT false,
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, event_id, member)
);
CREATE INDEX IF NOT EXISTS event_answers_unposted ON event_answers (chain_id, created_at) WHERE NOT posted;

CREATE TABLE IF NOT EXISTS event_calls (
  chain_id int NOT NULL,
  ticket_id bigint NOT NULL,
  event_id text NOT NULL,
  owner text NOT NULL,
  yes boolean NOT NULL,
  stake bigint NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'refunded')),
  amount bigint,
  call_tx text,
  paid_tx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, ticket_id)
);
CREATE INDEX IF NOT EXISTS event_calls_owner ON event_calls (chain_id, owner, created_at DESC);
CREATE INDEX IF NOT EXISTS event_calls_open ON event_calls (chain_id, event_id) WHERE status = 'open';
`;
