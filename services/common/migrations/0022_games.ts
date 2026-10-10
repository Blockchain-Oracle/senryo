/**
 * 0022 — games without a contract (S8.8, D-295). `lucky_draws`: each sealed draw (the server's seed kept here until
 * the reveal publishes it), the player's seed, the digest and what it dealt, and the call it became. `arcade_seeds`:
 * one server-issued seed per run, so a score can only be for a run the api started. `arcade_scores`: runs whose replay
 * reproduced their score ("checked · not on chain").
 */
export const id = "0022_games";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS lucky_draws (
  draw_id text PRIMARY KEY,
  chain_id int NOT NULL,
  owner text NOT NULL,
  server_seed text NOT NULL,
  commitment text NOT NULL,
  markets jsonb NOT NULL,
  markets_hash text NOT NULL,
  client_seed text,
  digest text,
  symbol text,
  side text,
  reach int,
  dealt jsonb,
  ticket_id bigint,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz
);
CREATE INDEX IF NOT EXISTS lucky_draws_owner ON lucky_draws (chain_id, owner, sealed_at DESC);

CREATE TABLE IF NOT EXISTS arcade_seeds (
  seed text PRIMARY KEY,
  game text NOT NULL,
  owner text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  used boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS arcade_seeds_owner ON arcade_seeds (owner, issued_at DESC);

CREATE TABLE IF NOT EXISTS arcade_scores (
  id bigserial PRIMARY KEY,
  game text NOT NULL,
  owner text NOT NULL,
  seed text NOT NULL REFERENCES arcade_seeds (seed),
  calm boolean NOT NULL,
  score int NOT NULL,
  ticks int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arcade_scores_board ON arcade_scores (game, score DESC, created_at);
CREATE INDEX IF NOT EXISTS arcade_scores_owner ON arcade_scores (owner, game, score DESC);
`;
