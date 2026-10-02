/**
 * 0011 — trade posts (F-D1: every feed item takes every post verb). A feed trade row gets a post of kind `trade`,
 * created on first use (a like, a reply, a report, a share), so likes, replies, reports and moderation reuse their
 * tables and routes unchanged:
 *  - `posts.feed_event_id` ties the trade post to its feed row (unique: one per row; deleting the row deletes it);
 *  - a trade post has no text of its own (the trade is the content) and no parent; every other kind keeps 1–280;
 *  - its author is the trader, so blocks, mutes and "delete my data" apply as they do to theses.
 * The kind and text CHECKs are replaced by name (Postgres named them `posts_kind_check` / `posts_text_check` in 0005).
 * 0009 = notifications inbox, 0010 = card issue. Forward-only, idempotent.
 */
export const id = "0011_trade_posts";

export const sql = /* sql */ `
ALTER TABLE posts ADD COLUMN IF NOT EXISTS feed_event_id bigint REFERENCES feed_events (id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS posts_feed_event_key ON posts (feed_event_id);

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_kind_check;
ALTER TABLE posts ADD CONSTRAINT posts_kind_check CHECK (kind IN ('thesis', 'reply', 'trade'));

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_text_check;
ALTER TABLE posts ADD CONSTRAINT posts_text_check
  CHECK (CASE WHEN kind = 'trade' THEN text = '' ELSE char_length(text) BETWEEN 1 AND 280 END);

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_trade_has_event;
ALTER TABLE posts ADD CONSTRAINT posts_trade_has_event CHECK ((kind = 'trade') = (feed_event_id IS NOT NULL));
`;
