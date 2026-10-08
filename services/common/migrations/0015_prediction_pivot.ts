/**
 * 0015 — the prediction-market pivot (D-256): the card, starter/voucher relays, social feed (posts, likes, follows,
 * moderation), inbox watches, wallet scans and engine price alerts are gone. Push channels become results · deposits
 * · price alerts · social (`ch_fills` carries on as `ch_results`). Old-product inbox rows are removed so the inbox
 * never shows a perp fill or a card event. Forward-only and idempotent.
 */
export const id = "0015_prediction_pivot";

export const sql = /* sql */ `
DROP TABLE IF EXISTS aurora_deposits, card_auth, card_events, cards, feed_cursors, feed_events, follows, holds,
  inbox_watches, ledger_entries, likes, moderation_reviews, mutes, blocks, outbox, posts, reports, starter_claims,
  vouchers, wallet_scans, wallet_transfers, price_alerts CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'push_tokens' AND column_name = 'ch_fills') THEN
    ALTER TABLE push_tokens RENAME COLUMN ch_fills TO ch_results;
  END IF;
END $$;
ALTER TABLE push_tokens DROP COLUMN IF EXISTS ch_liquidation, DROP COLUMN IF EXISTS ch_card,
  DROP COLUMN IF EXISTS ch_followed_trades;

DELETE FROM push_sends WHERE channel IN ('fills', 'liquidation', 'card', 'followedTrades');
`;
