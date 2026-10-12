/**
 * 0028 — the arcade's engine version and price tape on every seed (R7.2, D-318). Line Rider v2 is a new game (a sled
 * on the price line) with its own board: a seed is issued for the engine that will replay it, and the board ranks only
 * scores from the current engine; older rows are engine 1 and stay as history. `arcade_tapes` holds each price tape
 * once (a symbol's 1-minute moves over a day, recorded from the archive), and a seed names the tape it was issued with,
 * so the replay rides the same line the player rode.
 */
export const id = "0028_arcade_engine";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS arcade_tapes (
  id text PRIMARY KEY,
  symbol text NOT NULL,
  from_minute bigint NOT NULL,
  open_e8 bigint NOT NULL,
  moves int[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE arcade_seeds ADD COLUMN IF NOT EXISTS engine int NOT NULL DEFAULT 1;
ALTER TABLE arcade_seeds ADD COLUMN IF NOT EXISTS tape text REFERENCES arcade_tapes (id);
ALTER TABLE arcade_scores ADD COLUMN IF NOT EXISTS engine int NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS arcade_scores_engine_board ON arcade_scores (game, engine, score DESC, created_at);
`;
