/**
 * 0029 — the Status board's history (P6, D-324). Once a minute the api records each component's health — prices,
 * settlement, the relay, the keeper, the chain, the indexer, deposits — as one row per network and minute. The board
 * reads 24 hourly and 90 daily buckets from it (worst state, minutes seen, minutes healthy); a minute with no row is
 * an unknown, never a pass. The keeper's retention sweep deletes rows after 90 days.
 */
export const id = "0029_health_minutes";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS health_minutes (
  chain_id int NOT NULL,
  minute bigint NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, minute)
);
`;
