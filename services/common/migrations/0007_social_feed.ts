/**
 * 0007 — social feed, moderation and search (S12b.4–8, D-174). Forward-only, idempotent. `0006` is the lead's inbox
 * watches (S8.24); the runner applies migrations by id in array order.
 *
 * - `profiles.hidden`: an operator-confirmed moderation hide (weighted reports AND an admin review). Public reads treat
 *   a hidden profile like an unlisted one. The decision itself lives in `moderation_reviews`, so it survives
 *   "delete my data" and re-applies if the address makes a new profile.
 * - `profiles.public_trades_<network>_since`: when that network's trade sharing was last turned on. The feed shows a
 *   fill only if it happened after this moment — turning sharing on never publishes earlier trades. Rows already
 *   sharing start now (the deploy), never in the past.
 * - `profiles_handle_prefix_idx`: handle prefix search (`lower(handle) LIKE 'ab%'`) needs `text_pattern_ops`.
 * - `moderation_reviews`: one operator decision per reported target (`hide` | `keep`).
 */
export const id = "0007_social_feed";

export const sql = /* sql */ `
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_trades_practice_since timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_trades_mainnet_since timestamptz;
UPDATE profiles SET public_trades_practice_since = now()
 WHERE public_trades_practice AND public_trades_practice_since IS NULL;
UPDATE profiles SET public_trades_mainnet_since = now()
 WHERE public_trades_mainnet AND public_trades_mainnet_since IS NULL;

CREATE INDEX IF NOT EXISTS profiles_handle_prefix_idx ON profiles (lower(handle) text_pattern_ops)
  WHERE handle IS NOT NULL;

CREATE TABLE IF NOT EXISTS moderation_reviews (
  target_kind     text NOT NULL CHECK (target_kind IN ('post', 'profile')),
  target_id       text NOT NULL,
  decision        text NOT NULL CHECK (decision IN ('hide', 'keep')),
  note            text CHECK (char_length(note) <= 280),
  reviewed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (target_kind, target_id)
);

-- Reports by target regardless of status (weights count open + actioned), and the feed/thread anti-joins.
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports (target_kind, target_id, status);
CREATE INDEX IF NOT EXISTS mutes_muted_idx ON mutes (muted);
CREATE INDEX IF NOT EXISTS feed_events_post_idx ON feed_events (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_author_chain_idx ON posts (author, chain_id, created_at DESC);
`;
