/**
 * 0018 — exits (S8.4, D-292). `market_exits`: each ticket's standing take-profit, stop-loss, floor and trail as the
 * chain holds them (a share's bid × 1e6, 0 = unset), from the relay's own `setExit` receipts and the watcher's re-reads
 * of the chain; `trail_peak_e6` is the best bid the trail has seen (it only ever rises, so a restart never lowers the
 * stop); `fired_at` is the last time the watcher fired it (a miss re-arms after a pause).
 */
export const id = "0018_exits";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS market_exits (
  chain_id int NOT NULL,
  ticket_id bigint NOT NULL,
  take_profit_e6 int NOT NULL DEFAULT 0,
  stop_loss_e6 int NOT NULL DEFAULT 0,
  floor_e6 int NOT NULL DEFAULT 0,
  trail_e6 int NOT NULL DEFAULT 0,
  trail_peak_e6 int NOT NULL DEFAULT 0,
  fired_at timestamptz,
  fired_kind int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, ticket_id)
);
`;
