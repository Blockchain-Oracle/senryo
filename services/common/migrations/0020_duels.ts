/**
 * 0020 — duels (S8.6, D-294). `duel_entries` is the matchmaker's queue: each player's signed entry (with its permit)
 * until it is paired, cancelled or lapses. `duel_matches` and `duel_picks` follow the arena's own events in receipts
 * the services sent (as the ticket book does the reserve's): the keeper's work list for locks, card settlement and
 * the pot, and each card's result for both players. The server seed stays here until the reveal publishes it.
 */
export const id = "0020_duels";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS duel_entries (
  digest text PRIMARY KEY,
  chain_id int NOT NULL,
  owner text NOT NULL,
  tier int NOT NULL,
  body jsonb NOT NULL,
  deadline bigint NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'paired', 'cancelled', 'lapsed', 'failed')),
  match_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS duel_entries_queue ON duel_entries (chain_id, tier, created_at) WHERE state = 'queued';
CREATE INDEX IF NOT EXISTS duel_entries_owner ON duel_entries (chain_id, owner, created_at DESC);

CREATE TABLE IF NOT EXISTS duel_matches (
  chain_id int NOT NULL,
  match_id text NOT NULL,
  tier int NOT NULL,
  player_a text NOT NULL,
  player_b text NOT NULL,
  pot bigint NOT NULL,
  card_stake bigint NOT NULL,
  server_seed text NOT NULL,
  deck_hash text NOT NULL,
  cards jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('opening', 'sealed', 'picking', 'settling', 'forfeited', 'refunded',
                                       'finalized', 'failed')),
  reveal_by bigint,
  pick_deadline bigint,
  winner text,
  result_a bigint,
  result_b bigint,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, match_id)
);
CREATE INDEX IF NOT EXISTS duel_matches_a ON duel_matches (chain_id, player_a, created_at DESC);
CREATE INDEX IF NOT EXISTS duel_matches_b ON duel_matches (chain_id, player_b, created_at DESC);
CREATE INDEX IF NOT EXISTS duel_matches_work ON duel_matches (chain_id, state)
  WHERE state IN ('sealed', 'picking', 'settling', 'forfeited', 'refunded');

CREATE TABLE IF NOT EXISTS duel_picks (
  chain_id int NOT NULL,
  match_id text NOT NULL,
  card int NOT NULL,
  seat int NOT NULL,
  player text NOT NULL,
  band int NOT NULL,
  ticket_id bigint NOT NULL,
  returned bigint,
  result bigint,
  PRIMARY KEY (chain_id, match_id, card, seat)
);
CREATE INDEX IF NOT EXISTS duel_picks_ticket ON duel_picks (chain_id, ticket_id);
`;
