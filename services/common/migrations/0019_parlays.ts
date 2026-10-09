/**
 * 0019 — parlays (S8.5, D-293). `market_parlays` and `market_parlay_legs`: what the relay and keeper know of every
 * parlay, driven by the reserve's own parlay events (as `market_tickets` is by its ticket events) — the keeper's work
 * list for fills, leg verdicts and payouts, and each leg's outcome for the slips. A relayed parlay is an intent like a
 * call (`market_intents.kind = 'parlay'`), so its status reaches the caller the same way.
 */
export const id = "0019_parlays";

export const sql = /* sql */ `
ALTER TABLE market_intents DROP CONSTRAINT IF EXISTS market_intents_kind_check;
ALTER TABLE market_intents ADD CONSTRAINT market_intents_kind_check CHECK (kind IN ('open', 'close', 'parlay'));

CREATE TABLE IF NOT EXISTS market_parlays (
  chain_id int NOT NULL,
  parlay_id bigint NOT NULL,
  owner text NOT NULL,
  state text NOT NULL CHECK (state IN ('committed', 'open', 'settled', 'refunded')),
  target bigint,
  stake bigint NOT NULL,
  payout bigint NOT NULL DEFAULT 0,
  chance_e6 int,
  result bigint,
  outcome text CHECK (outcome IN ('win', 'lose', 'refund')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, parlay_id)
);
CREATE INDEX IF NOT EXISTS market_parlays_owner ON market_parlays (chain_id, owner, parlay_id DESC);
CREATE INDEX IF NOT EXISTS market_parlays_work ON market_parlays (chain_id, state) WHERE state IN ('committed', 'open');

CREATE TABLE IF NOT EXISTS market_parlay_legs (
  chain_id int NOT NULL,
  parlay_id bigint NOT NULL,
  leg int NOT NULL,
  window_id text NOT NULL,
  series_id text NOT NULL,
  window_start bigint NOT NULL,
  window_expiry bigint NOT NULL,
  band int NOT NULL,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'won', 'tied', 'lost', 'void')),
  PRIMARY KEY (chain_id, parlay_id, leg)
);
`;
