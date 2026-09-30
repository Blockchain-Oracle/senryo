/**
 * 0002 — api + keeper tables (specs/services.md, D-040, D-111). Forward-only, idempotent (`IF NOT EXISTS`).
 */
export const id = "0002_api";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS siwe_nonces (
  nonce           text PRIMARY KEY,
  address         text NOT NULL,
  chain_id        integer NOT NULL,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS starter_claims (
  id              uuid PRIMARY KEY,
  kind            text NOT NULL CHECK (kind IN ('claim', 'voucher')),
  chain_id        integer NOT NULL,
  user_address    text NOT NULL,
  code_hash       text,
  tx_hash         text,
  stage           text NOT NULL,
  block_number    bigint,
  native_wei      numeric(78, 0) NOT NULL DEFAULT 0,
  credit_usd6     bigint NOT NULL DEFAULT 0,
  ip_prefix       text,
  device_hash     text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS starter_claims_user_idx ON starter_claims (chain_id, user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS starter_claims_ip_idx ON starter_claims (ip_prefix, created_at DESC);
CREATE INDEX IF NOT EXISTS starter_claims_device_idx ON starter_claims (device_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS vouchers (
  code_hash       text PRIMARY KEY,
  chain_id        integer NOT NULL,
  label           text,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  redeemed_by     text,
  redeemed_at     timestamptz,
  tx_hash         text
);

CREATE TABLE IF NOT EXISTS prefs_blobs (
  address         text PRIMARY KEY,
  blob            text NOT NULL,
  version         integer NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vault_blobs (
  credential_id   text PRIMARY KEY,
  address         text NOT NULL,
  label           text,
  vault           jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vault_blobs_address_idx ON vault_blobs (address);

CREATE TABLE IF NOT EXISTS price_alerts (
  id              uuid PRIMARY KEY,
  user_address    text NOT NULL,
  chain_id        integer NOT NULL,
  market_id       smallint NOT NULL,
  direction       text NOT NULL CHECK (direction IN ('above', 'below')),
  price18         numeric(78, 0) NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled')),
  triggered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_alerts_active_idx ON price_alerts (chain_id, market_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS push_tokens (
  token           text PRIMARY KEY,
  user_address    text NOT NULL,
  platform        text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  kind            text NOT NULL DEFAULT 'expo' CHECK (kind IN ('expo', 'live_activity')),
  ch_fills        boolean NOT NULL DEFAULT true,
  ch_liquidation  boolean NOT NULL DEFAULT true,
  ch_deposits     boolean NOT NULL DEFAULT true,
  ch_card         boolean NOT NULL DEFAULT true,
  ch_price_alerts boolean NOT NULL DEFAULT true,
  disabled_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_address);

CREATE TABLE IF NOT EXISTS push_sends (
  event_key       text PRIMARY KEY,
  user_address    text NOT NULL,
  channel         text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id              bigserial PRIMARY KEY,
  name            text NOT NULL,
  user_address    text,
  device_hash     text,
  platform        text,
  app_version     text,
  props           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_name_idx ON events (name, created_at DESC);

CREATE TABLE IF NOT EXISTS aurora_deposits (
  id              uuid PRIMARY KEY,
  user_address    text NOT NULL,
  execution_id    text UNIQUE,
  status          text NOT NULL,
  source_chain    text,
  asset           text,
  amount          text,
  recipient       text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aurora_deposits_user_idx ON aurora_deposits (user_address, created_at DESC);

CREATE TABLE IF NOT EXISTS keeper_state (
  job             text PRIMARY KEY,
  last_tick_at    timestamptz NOT NULL DEFAULT now(),
  state           jsonb NOT NULL DEFAULT '{}'::jsonb
);
`;
