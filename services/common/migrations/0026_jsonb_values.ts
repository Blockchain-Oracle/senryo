/**
 * 0026 — jsonb columns hold JSON, not a JSON string (R4.8). Values written as `${JSON.stringify(v)}::jsonb` were stored
 * as one string (postgres.js sends a string parameter for a jsonb cast as a JSON string), so every reader of them got
 * a string: a duel's cards, a Lucky draw's markets and deal, an event's teams, a relayed intent's body. Writes now go
 * through `jsonb()`; this unwraps the rows already stored.
 */
export const id = "0026_jsonb_values";

export const sql = /* sql */ `
UPDATE duel_matches SET cards = (cards #>> '{}')::jsonb WHERE jsonb_typeof(cards) = 'string';
UPDATE lucky_draws SET markets = (markets #>> '{}')::jsonb WHERE jsonb_typeof(markets) = 'string';
UPDATE lucky_draws SET dealt = (dealt #>> '{}')::jsonb WHERE dealt IS NOT NULL AND jsonb_typeof(dealt) = 'string';
UPDATE market_events SET home = (home #>> '{}')::jsonb WHERE jsonb_typeof(home) = 'string';
UPDATE market_events SET away = (away #>> '{}')::jsonb WHERE jsonb_typeof(away) = 'string';
UPDATE market_intents SET body = (body #>> '{}')::jsonb WHERE jsonb_typeof(body) = 'string';
`;
