/**
 * 0016 — the markets' services (S3, D-272, D-278).
 *  - `pyth_prints`: the unique Pyth print at an instant (window boundaries every minute, fill targets on demand), with
 *    the update bytes the chain verifies. Written by the api's one Pyth gateway, read by the relay, keeper and Proof.
 *  - `price_candles`: 1-minute candles per feed, folded from the stream (charts; closed minutes are immutable).
 *  - `market_intents`: the relay's queue, keyed by the EIP-712 digest so a signed call posted twice is one call.
 *  - `market_tickets`: tickets the services know of (from relayed commits and the reserve's logs) — the keeper's work
 *    list for fills, settlement and payouts until the indexer (S4) serves history.
 *  - `practice_grants`: Test USD handed to an account (one grant, then a daily top-up).
 *  - `relay_journal`: the senders' tx journal (journal before broadcast; recovery after a restart).
 */
export const id = "0016_markets";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS pyth_prints (
  feed_id text NOT NULL,
  t bigint NOT NULL,
  publish_time bigint NOT NULL,
  prev_publish_time bigint NOT NULL,
  price bigint NOT NULL,
  conf bigint NOT NULL,
  expo int NOT NULL,
  update_hex text NOT NULL,
  source text NOT NULL CHECK (source IN ('stream', 'rest')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feed_id, t),
  CHECK (prev_publish_time < t AND t <= publish_time)
);

CREATE TABLE IF NOT EXISTS price_candles (
  feed_id text NOT NULL,
  minute bigint NOT NULL,
  open bigint NOT NULL,
  high bigint NOT NULL,
  low bigint NOT NULL,
  close bigint NOT NULL,
  PRIMARY KEY (feed_id, minute)
);

CREATE TABLE IF NOT EXISTS market_intents (
  digest text PRIMARY KEY,
  chain_id int NOT NULL,
  owner text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('open', 'close')),
  body jsonb NOT NULL,
  state text NOT NULL DEFAULT 'received'
    CHECK (state IN ('received', 'submitted', 'committed', 'filled', 'refused', 'failed')),
  ticket_id bigint,
  tx_hash text,
  target bigint,
  reason text,
  lane int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_intents_pending ON market_intents (chain_id, state) WHERE state IN ('received', 'submitted');
CREATE INDEX IF NOT EXISTS market_intents_owner ON market_intents (chain_id, owner, created_at DESC);

CREATE TABLE IF NOT EXISTS market_tickets (
  chain_id int NOT NULL,
  ticket_id bigint NOT NULL,
  owner text NOT NULL,
  window_id text NOT NULL,
  series_id text NOT NULL,
  window_start bigint NOT NULL,
  window_expiry bigint NOT NULL,
  band int NOT NULL,
  state text NOT NULL CHECK (state IN ('committed', 'open', 'closing', 'closed', 'settled', 'refunded')),
  target bigint,
  stake bigint NOT NULL,
  payout bigint NOT NULL DEFAULT 0,
  entry_e8 bigint,
  result bigint,
  outcome text CHECK (outcome IN ('win', 'lose', 'refund')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, ticket_id)
);
CREATE INDEX IF NOT EXISTS market_tickets_owner ON market_tickets (chain_id, owner, ticket_id DESC);
CREATE INDEX IF NOT EXISTS market_tickets_work ON market_tickets (chain_id, window_expiry)
  WHERE state IN ('committed', 'open', 'closing');

CREATE TABLE IF NOT EXISTS practice_grants (
  chain_id int NOT NULL,
  address text NOT NULL,
  amount bigint NOT NULL,
  tx_hash text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, address, granted_at)
);
CREATE INDEX IF NOT EXISTS practice_grants_latest ON practice_grants (chain_id, address, granted_at DESC);

CREATE TABLE IF NOT EXISTS relay_journal (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;
