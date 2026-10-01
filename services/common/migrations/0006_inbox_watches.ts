/**
 * 0006 — deposit inbox watches (S8.24, D-179). A counterfactual inbox is invisible to the indexer until its first
 * sweep deploys it, so the api records it when the app shows the address and the keeper's `sweeps` job reads its
 * balance until `expires_at`. Lowercase addresses (one row per chain + user). Forward-only, idempotent.
 */
export const id = "0006_inbox_watches";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS inbox_watches (
  chain_id        integer NOT NULL,
  user_address    text NOT NULL,
  inbox           text NOT NULL,
  expires_at      timestamptz NOT NULL,
  last_swept_at   timestamptz,
  sweep_count     integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, user_address)
);
CREATE INDEX IF NOT EXISTS inbox_watches_active_idx ON inbox_watches (chain_id, expires_at);
`;
