/**
 * 0009 — notifications inbox (G1, D7). `push_sends`, the push dedupe ledger, becomes the inbox: each row now carries
 * what the push said (`title`, `body`, the `url` a tap opens, the `subject` whose mark the row shows — `{kind:'market',
 * marketId}` | `{kind:'token', address}` | `{kind:'person', address}` | `{kind:'card'}` | `{kind:'account'}`) and when
 * the user read it. `sent_at` stays the row's creation time (the inbox's `createdAt`); rows from before this migration
 * have no title and are left out of the inbox.
 *
 * Delivery becomes an outbox any service can write: a row is queued with `next_attempt_at`, and the keeper of that
 * network claims it by its event key (one sender per row), records `attempts` and `delivered` (null = not attempted,
 * true = Expo accepted it for ≥ 1 device, false = failed or no device), and re-queues a failed attempt once.
 * `collapse_key` lets a retried health warning still replace the one on screen.
 *
 * `push_tokens` gains the social channels: `ch_social` (new follower, likes and replies; on by default) and
 * `ch_followed_trades` (a trader you follow opened a position; opt-in). Forward-only, idempotent.
 */
export const id = "0009_notification_inbox";

export const sql = /* sql */ `
ALTER TABLE push_sends
  ADD COLUMN IF NOT EXISTS title           text,
  ADD COLUMN IF NOT EXISTS body            text,
  ADD COLUMN IF NOT EXISTS url             text,
  ADD COLUMN IF NOT EXISTS subject         jsonb,
  ADD COLUMN IF NOT EXISTS collapse_key    text,
  ADD COLUMN IF NOT EXISTS read_at         timestamptz,
  ADD COLUMN IF NOT EXISTS delivered       boolean,
  ADD COLUMN IF NOT EXISTS attempts        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
CREATE INDEX IF NOT EXISTS push_sends_inbox_idx ON push_sends (chain_id, user_address, sent_at DESC, event_key DESC);
CREATE INDEX IF NOT EXISTS push_sends_unread_idx ON push_sends (chain_id, user_address)
  WHERE read_at IS NULL AND title IS NOT NULL;
CREATE INDEX IF NOT EXISTS push_sends_due_idx ON push_sends (chain_id, next_attempt_at)
  WHERE next_attempt_at IS NOT NULL;

ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS ch_social          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ch_followed_trades boolean NOT NULL DEFAULT false;
`;
