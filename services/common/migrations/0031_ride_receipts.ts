/**
 * 0031 — what a ride's receipt needs once it has ended (R5.11, D-331): the margin it opened with (`margin` shrinks as
 * parts close and reads 0 at the end) and, already kept, the transaction that last moved it (`last_tx`: the one that
 * ended it). Rides that never closed a part keep their margin as the original; rides already past a part read null.
 */
export const id = "0031_ride_receipts";

export const sql = /* sql */ `
ALTER TABLE market_rides ADD COLUMN IF NOT EXISTS margin_open bigint;
UPDATE market_rides SET margin_open = margin
  WHERE margin_open IS NULL AND state IN ('committed', 'open', 'closing', 'refunded') AND pnl IS NULL;
`;
