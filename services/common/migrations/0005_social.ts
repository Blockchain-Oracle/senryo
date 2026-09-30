/**
 * 0005 — social layer (S12b, D-174, v2-plan W5/§5.9). Forward-only, idempotent (`IF NOT EXISTS`).
 * Addresses are lower-case hex; handles are stored lower-case and unique case-insensitively.
 *
 * Privacy (one address on both networks): a profile is shown on a network only when `listed_<network>` is on, and a
 * network's public trades need that network's listing (CHECK below). Defaults mirror `PROFILE_VISIBILITY_DEFAULTS`
 * in `@senryo/api-client`: practice listed + public, mainnet off until the user opts in.
 *
 * `0004` is the lead's starter top-up kind (W1); the runner applies migrations by id, so the gap is harmless.
 */
export const id = "0005_social";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS profiles (
  address                 text PRIMARY KEY CHECK (address ~ '^0x[0-9a-f]{40}$'),
  handle                  text CHECK (handle ~ '^[a-z0-9_]{4,20}$'),
  display_name            text CHECK (char_length(display_name) BETWEEN 1 AND 32),
  bio                     text CHECK (char_length(bio) BETWEEN 1 AND 160),
  avatar                  text CHECK (avatar ~ '^[a-z0-9-]{1,32}$'),
  listed_practice         boolean NOT NULL DEFAULT true,
  listed_mainnet          boolean NOT NULL DEFAULT false,
  public_trades_practice  boolean NOT NULL DEFAULT true,
  public_trades_mainnet   boolean NOT NULL DEFAULT false,
  handle_changed_at       timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_public_practice_listed CHECK (listed_practice OR NOT public_trades_practice),
  CONSTRAINT profiles_public_mainnet_listed CHECK (listed_mainnet OR NOT public_trades_mainnet)
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key ON profiles (lower(handle)) WHERE handle IS NOT NULL;

-- A released handle (changed or deleted) is held for its previous owner for 30 days: no instant re-squat/impersonation.
CREATE TABLE IF NOT EXISTS handle_tombstones (
  handle          text PRIMARY KEY CHECK (handle ~ '^[a-z0-9_]{4,20}$'),
  address         text NOT NULL,
  released_at     timestamptz NOT NULL DEFAULT now(),
  held_until      timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS handle_tombstones_address_idx ON handle_tombstones (address, released_at DESC);

-- Follows are account-level (the same address on both networks); lists and counts filter by the network's listing.
-- \`id\` is the keyset cursor for followers/following pages. The per-account cap is enforced in the route.
CREATE TABLE IF NOT EXISTS follows (
  id              bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  follower        text NOT NULL,
  followee        text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower, followee),
  CHECK (follower <> followee)
);
CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee, id DESC);
CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows (follower, id DESC);

-- Theses and replies (per network). market_id / position_id are indexer entity ids (\`ours-0\`, \`perpl-16\`, …).
CREATE TABLE IF NOT EXISTS posts (
  id              uuid PRIMARY KEY,
  chain_id        integer NOT NULL,
  author          text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('thesis', 'reply')),
  parent_id       uuid REFERENCES posts (id) ON DELETE CASCADE,
  position_id     text,
  market_id       text,
  text            text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 280),
  hidden          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT posts_reply_has_parent CHECK ((kind = 'reply') = (parent_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS posts_chain_idx ON posts (chain_id, created_at DESC) WHERE NOT hidden;
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts (author, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_parent_idx ON posts (parent_id, created_at) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_market_idx ON posts (chain_id, market_id, created_at DESC) WHERE market_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS likes (
  post_id         uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  address         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, address)
);
CREATE INDEX IF NOT EXISTS likes_address_idx ON likes (address);

-- App Store 1.2: reports are weighted (claimed/funded reporters only) and auto-hide needs admin review too.
CREATE TABLE IF NOT EXISTS reports (
  id              uuid PRIMARY KEY,
  target_kind     text NOT NULL CHECK (target_kind IN ('post', 'profile')),
  target_id       text NOT NULL,
  reporter        text NOT NULL,
  reason          text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 32),
  note            text CHECK (char_length(note) <= 280),
  weight          smallint NOT NULL DEFAULT 0 CHECK (weight >= 0),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_kind, target_id, reporter)
);
CREATE INDEX IF NOT EXISTS reports_open_idx ON reports (target_kind, target_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports (reporter);

CREATE TABLE IF NOT EXISTS blocks (
  blocker         text NOT NULL,
  blocked         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked),
  CHECK (blocker <> blocked)
);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks (blocked);

CREATE TABLE IF NOT EXISTS mutes (
  muter           text NOT NULL,
  muted           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter, muted),
  CHECK (muter <> muted)
);

-- Feed items per network (S12b.4 poller: indexed Fill/Position rows of opted-in accounts, plus theses).
-- \`id\` is the serving cursor; (chain_id, source_id) makes ingestion idempotent; \`block\` orders by chain position.
CREATE TABLE IF NOT EXISTS feed_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id        integer NOT NULL,
  source_id       text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('fill', 'position', 'thesis')),
  actor           text NOT NULL,
  market_id       text,
  position_id     text,
  post_id         uuid REFERENCES posts (id) ON DELETE CASCADE,
  block           bigint,
  occurred_at     timestamptz NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, source_id)
);
CREATE INDEX IF NOT EXISTS feed_events_chain_idx ON feed_events (chain_id, id DESC);
CREATE INDEX IF NOT EXISTS feed_events_actor_idx ON feed_events (chain_id, actor, id DESC);
CREATE INDEX IF NOT EXISTS feed_events_market_idx ON feed_events (chain_id, market_id, id DESC) WHERE market_id IS NOT NULL;

-- The poller's resume point per (network, source), e.g. ('fill', '<block>:<logIndex>'). Opted-out rows are skipped,
-- so max(feed_events) is not a cursor.
CREATE TABLE IF NOT EXISTS feed_cursors (
  chain_id        integer NOT NULL,
  source          text NOT NULL,
  cursor          text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, source)
);
`;
