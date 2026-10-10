/**
 * 0024 — rides (R4.6, D-299, D-301). Rides go through the same relay queue as calls (`market_intents`, now with a
 * `book`), and the services keep their own book of them:
 *  - `market_rides`: each ride as the chain holds it, from the relay's receipts and the keeper's sync — its state, the
 *    pending fill instant and limit, the fill (entry, size, reserve, knock-out and cap prices) and how it ended. Sizes
 *    are uint128 and PnL int256 on chain, so they are `numeric`.
 *  - `ride_exits`: each ride's take-profit, stop-loss, floor and trail (prices × 1e8, the trail a distance), with the
 *    trail's best price seen (it only moves in the ride's favour) and the watcher's last fire.
 */
export const id = "0024_rides";

export const sql = /* sql */ `
ALTER TABLE market_intents ADD COLUMN IF NOT EXISTS book text NOT NULL DEFAULT 'call' CHECK (book IN ('call', 'ride'));
ALTER TABLE market_intents ADD COLUMN IF NOT EXISTS ride_id bigint;

CREATE TABLE IF NOT EXISTS market_rides (
  chain_id int NOT NULL,
  ride_id bigint NOT NULL,
  owner text NOT NULL,
  market_id int NOT NULL,
  is_long boolean NOT NULL,
  state text NOT NULL
    CHECK (state IN ('committed', 'open', 'closing', 'closed', 'knocked_out', 'capped', 'ended', 'refunded')),
  margin bigint NOT NULL,
  leverage_bps int NOT NULL,
  open_fee bigint NOT NULL,
  target bigint,
  limit_e8 bigint,
  closing numeric(39, 0) NOT NULL DEFAULT 0,
  entry_e8 bigint,
  size numeric(39, 0) NOT NULL DEFAULT 0,
  reserve bigint NOT NULL DEFAULT 0,
  ko_e8 bigint,
  cap_e8 bigint,
  filled_at bigint,
  end_at bigint,
  exit_e8 bigint,
  pnl numeric(78, 0),
  fees bigint NOT NULL DEFAULT 0,
  paid bigint NOT NULL DEFAULT 0,
  how int,
  refund_reason int,
  commit_tx text,
  last_tx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, ride_id)
);
CREATE INDEX IF NOT EXISTS market_rides_owner ON market_rides (chain_id, owner, ride_id DESC);
CREATE INDEX IF NOT EXISTS market_rides_live ON market_rides (chain_id, market_id, is_long)
  WHERE state IN ('committed', 'open', 'closing');

CREATE TABLE IF NOT EXISTS ride_exits (
  chain_id int NOT NULL,
  ride_id bigint NOT NULL,
  take_profit_e8 bigint NOT NULL DEFAULT 0,
  stop_loss_e8 bigint NOT NULL DEFAULT 0,
  floor_e8 bigint NOT NULL DEFAULT 0,
  trail_e8 bigint NOT NULL DEFAULT 0,
  trail_peak_e8 bigint NOT NULL DEFAULT 0,
  fired_at timestamptz,
  fired_kind int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, ride_id)
);
`;
