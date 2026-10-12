/**
 * 0027 — an event's game as it plays (F12): the keeper reads its status and score from ESPN (the committee's own
 * source) every 30 s while the game is on, so the card shows "LIVE · 2nd 12:41 · 2–1" and then the final. Display
 * only: the committee still decides the event from its three sources.
 */
export const id = "0027_event_live";

export const sql = /* sql */ `
ALTER TABLE market_events ADD COLUMN IF NOT EXISTS live jsonb;
`;
