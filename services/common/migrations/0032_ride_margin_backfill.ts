/**
 * 0032 — the opening margin for rides that ended before 0031 (R5.11 receipts): `margin` reads 0 once a ride has ended, so
 * 0031 could not recover it, but the relay kept the signed open (`market_intents`, `book = 'ride'`, `kind = 'open'`)
 * and its `margin` is the exact amount the ride opened with: the ride receipt (R5.11) reads it.
 */
export const id = "0032_ride_margin_backfill";

export const sql = /* sql */ `
UPDATE market_rides r SET margin_open = (i.body->'intent'->>'margin')::bigint
  FROM market_intents i
  WHERE r.margin_open IS NULL
    AND i.chain_id = r.chain_id AND i.ride_id = r.ride_id
    AND i.book = 'ride' AND i.kind = 'open' AND i.state = 'filled'
    AND i.body->'intent'->>'margin' IS NOT NULL;
`;
