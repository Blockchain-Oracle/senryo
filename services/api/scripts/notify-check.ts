/**
 * G1/D7 notifications check (targeted, not a UI test): the inbox ledger end to end against a scratch Postgres —
 * record (idempotent on the event key) → list (newest first, cursor, unread, per network) → mark read (ids, before);
 * social notifications only where the recipient may see the actor (mutes, self-actions, repeats, opt-in followed
 * trades through the real feed poller); the card, arrival and starter hooks; and the keeper's delivery path with Expo
 * faked: one retry after a failure and never a second, one send under racing claims, dead tokens, switched-off
 * channels and stale pushes. It migrates that database and deletes only its own rows.
 *   createdb senryo_notify_check
 *   DATABASE_URL=postgres://127.0.0.1:5432/senryo_notify_check pnpm --filter @senryo/api notify-check
 */

import { deliveryChecks } from "./notify-checks/delivery.ts";
import { followedDeliveryChecks } from "./notify-checks/followed-delivery.ts";
import { inboxChecks } from "./notify-checks/inbox.ts";
import { Checks, cleanup, openHarness } from "./social-harness.ts";

const h = await openHarness();
const checks = new Checks();

try {
  for (const [name, suite] of [
    ["inbox: record → list → read", inboxChecks],
    ["delivery: retry once", deliveryChecks],
    ["followed trades: recovery and privacy", followedDeliveryChecks],
  ] as const) {
    console.log(`\n── ${name}`);
    await suite(h, checks);
  }
} finally {
  await cleanup(h.db, h.addresses);
  await h.close();
}

console.log(`\n${checks.total - checks.failed}/${checks.total} notification checks passed`);
process.exitCode = checks.failed === 0 ? 0 : 1;
