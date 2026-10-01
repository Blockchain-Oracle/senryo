/**
 * 0008 — Expo push tickets (S1b push delivery). Every message Expo accepted leaves a ticket id; the keeper's
 * `receipts` job fetches its receipt ≥ 15 min later (Expo's guidance), records `status`/`error`, disables the token on
 * `DeviceNotRegistered`, and deletes checked rows after a week. `event_key` is the chain-prefixed `push_sends` key, so
 * each network's keeper checks only its own tickets. Forward-only, idempotent.
 */
export const id = "0008_push_tickets";

export const sql = /* sql */ `
CREATE TABLE IF NOT EXISTS push_tickets (
  ticket_id       text PRIMARY KEY,
  token           text NOT NULL,
  event_key       text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  checked_at      timestamptz,
  status          text,
  error           text
);
CREATE INDEX IF NOT EXISTS push_tickets_unchecked_idx ON push_tickets (created_at) WHERE checked_at IS NULL;
CREATE INDEX IF NOT EXISTS push_tickets_checked_idx ON push_tickets (checked_at) WHERE checked_at IS NOT NULL;
`;
