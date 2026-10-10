/**
 * 0023 — σ marks (R4.3, D-300, D-313). `sigma_marks`: each feed's volatility through each minute boundary, the fast
 * mark and the slow anchor (σ per √second × 1e8), with the running EWMA state they came from (the minute's boundary
 * price and both variances), so the next minute is this one plus one return. One row per feed and minute: whoever
 * computes a minute first (the keeper, or the relay at a fill) writes it, and every service reads that row. The values
 * are the same on every chain; each service signs them under its own chain's domain when it sends a fill.
 */
export const id = "0023_sigma_marks";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS sigma_marks (
  feed_id text NOT NULL,
  minute bigint NOT NULL,
  fast_e8 bigint NOT NULL CHECK (fast_e8 > 0),
  slow_e8 bigint NOT NULL CHECK (slow_e8 > 0),
  price_e8 bigint,
  fast_var double precision NOT NULL,
  fast_seen int NOT NULL,
  slow_var double precision NOT NULL,
  slow_seen int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feed_id, minute),
  CHECK (minute % 60 = 0)
);
CREATE INDEX IF NOT EXISTS sigma_marks_minute ON sigma_marks (minute);
`;
