/**
 * 0013 — wallet transfers (D8, flow book B12): every movement the api's HyperSync scan sees for an address it was asked
 * about — ERC-20 `Transfer` logs, WMON wraps and unwraps, and native MON (a transaction's own value, or an internal call
 * where the network serves traces) — so Activity can say "Received 20 USDC" for money the indexer never sees.
 *  - One row per movement, shared by both sides; idempotent on (chain_id, tx_hash, log_index, trace_address). A log
 *    row keeps its log index and `trace_address = ''`; a native MON row has `log_index = -1` and the call's path
 *    (`''` = the transaction itself, `'0.9.0.3'` = an internal call).
 *  - `token` is lower-case (`0x000…000` = native MON); `value` is the raw amount, numeric(78,0), never a float, never 0
 *    (zero-value transfers are address-poisoning noise and are not stored).
 *  - `tx_from` is the transaction's sender: a "sent" event in someone else's transaction is how fake tokens poison
 *    histories, so the route reads it.
 *  - `wallet_scans` keeps each address's scan cursors (logs + transactions, and internal calls), so a restart resumes
 *    where the last scan stopped. Rows are written only below a finality margin, so a reorg never leaves one behind.
 * Forward-only, idempotent.
 */
export const id = "0013_wallet_transfers";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS wallet_transfers (
  chain_id        integer NOT NULL,
  tx_hash         text NOT NULL CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index       integer NOT NULL CHECK (log_index >= -1),
  trace_address   text NOT NULL DEFAULT '' CHECK (trace_address ~ '^([0-9]+(\\.[0-9]+)*)?$'),
  block_number    bigint NOT NULL CHECK (block_number >= 0),
  tx_index        integer NOT NULL CHECK (tx_index >= 0),
  block_timestamp bigint NOT NULL CHECK (block_timestamp >= 0),
  token           text NOT NULL CHECK (token ~ '^0x[0-9a-f]{40}$'),
  from_address    text NOT NULL CHECK (from_address ~ '^0x[0-9a-f]{40}$'),
  to_address      text NOT NULL CHECK (to_address ~ '^0x[0-9a-f]{40}$'),
  tx_from         text CHECK (tx_from ~ '^0x[0-9a-f]{40}$'),
  value           numeric(78, 0) NOT NULL CHECK (value > 0),
  PRIMARY KEY (chain_id, tx_hash, log_index, trace_address)
);
CREATE INDEX IF NOT EXISTS wallet_transfers_from_idx
  ON wallet_transfers (chain_id, from_address, block_number DESC, tx_index DESC);
CREATE INDEX IF NOT EXISTS wallet_transfers_to_idx
  ON wallet_transfers (chain_id, to_address, block_number DESC, tx_index DESC);

CREATE TABLE IF NOT EXISTS wallet_scans (
  chain_id          integer NOT NULL,
  address           text NOT NULL CHECK (address ~ '^0x[0-9a-f]{40}$'),
  next_block        bigint NOT NULL DEFAULT 0 CHECK (next_block >= 0),
  trace_next_block  bigint NOT NULL DEFAULT 0 CHECK (trace_next_block >= 0),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, address)
);
`;
