import { followRoute, notificationsListRoute } from "@senryo/api-client";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import {
  createLogger,
  type ExpoMessage,
  MS_PER_SECOND,
  PushDelivery,
  type PushTransport,
} from "@senryo/service-common";
import { sharingStart } from "../social-checks/feed.ts";
import { fill, member, nowSec } from "../social-checks/seed.ts";
import type { Checks, Harness } from "../social-harness.ts";
import { addToken } from "./tokens.ts";

const T = TESTNET_CHAIN_ID;

/** Real ledger rollback and privacy races, with no actual push sent to a device. */
export async function followedDeliveryChecks(h: Harness, c: Checks): Promise<void> {
  const messages: ExpoMessage[] = [];
  const transport: PushTransport = {
    async send(batch) {
      messages.push(...batch);
      return batch.map(() => ({
        status: "error" as const,
        message: "check",
        details: { error: "MessageRateExceeded" },
      }));
    },
  };
  const delivery = new PushDelivery(h.db, createLogger("notify-check", "silent"), transport);
  const trader = await member(h);
  const follower = await member(h);
  await follower.api.call(followRoute, { params: { address: trader.address } });
  await addToken(h, follower, "ios", { ch_followed_trades: true });
  const at = Math.max(nowSec() + 1, await sharingStart(h, trader));
  const f = fill(h, { user: trader, at });
  const cursor = async () =>
    (await h.db<{ cursor: string }[]>`SELECT cursor FROM feed_cursors WHERE chain_id = ${T} AND source = 'fill'`)[0]
      ?.cursor;
  const before = await cursor();
  // Fail the actual INSERT, after the feed write: the page/cursor/outbox must roll back together.
  await h.db.unsafe(
    `CREATE FUNCTION notify_check_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'notification check failure'; END $$`,
  );
  await h.db.unsafe(
    `CREATE TRIGGER notify_check_abort BEFORE INSERT ON push_sends FOR EACH ROW WHEN (NEW.user_address = '${follower.lower}' AND NEW.channel = 'followedTrades') EXECUTE FUNCTION notify_check_abort()`,
  );
  let failed = false;
  try {
    await h.poller.pollChain(T);
  } catch {
    failed = true;
  } finally {
    await h.db`DROP TRIGGER notify_check_abort ON push_sends`;
    await h.db`DROP FUNCTION notify_check_abort()`;
  }
  const [rolledBack] = await h.db<
    { n: number }[]
  >`SELECT count(*)::int AS n FROM feed_events WHERE chain_id = ${T} AND source_id = ${`fill:${f.id}`}`;
  c.record(
    "followed outbox: recording failure rolls back the feed and cursor",
    failed && rolledBack?.n === 0 && before === (await cursor()),
  );
  await h.poller.pollChain(T);
  await h.poller.pollChain(T);
  const inbox = async () =>
    (await follower.api.call(notificationsListRoute, { query: { chainId: T } })).items.filter(
      (n) => n.channel === "followedTrades",
    );
  const item = (await inbox())[0];
  c.record(
    "followed outbox: retry commits one notification despite repeated ingestion",
    (await inbox()).length === 1 && Boolean(item),
  );
  if (!item) return;
  const first = await delivery.deliverNow(item.id);
  c.record(
    "followed privacy: an eligible queued trade reaches the transport",
    first === "failed" && messages.length === 1,
  );
  // A retry after an unfollow must not send the original copy again.
  await h.db`DELETE FROM follows WHERE follower = ${follower.lower} AND followee = ${trader.lower}`;
  await h.db`UPDATE push_sends SET next_attempt_at = now() WHERE event_key = ${item.id}`;
  const suppressed = await delivery.deliverNow(item.id);
  c.record(
    "followed privacy: unfollow before retry suppresses delivery and hides inbox copy",
    suppressed === "no_device" && messages.length === 1 && (await inbox()).length === 0,
  );
  await h.db`INSERT INTO follows (follower, followee, created_at) VALUES (${follower.lower}, ${trader.lower}, ${new Date((at + 1) * MS_PER_SECOND)})`;
  c.record("followed privacy: following again cannot republish an earlier trade", (await inbox()).length === 0);
  // Restore the original follow to isolate the other visibility rules.
  await h.db`UPDATE follows SET created_at = ${new Date((at - 1) * MS_PER_SECOND)} WHERE follower = ${follower.lower} AND followee = ${trader.lower}`;
  const cases: Array<[string, () => Promise<unknown>, () => Promise<unknown>]> = [
    [
      "mute",
      () => h.db`INSERT INTO mutes (muter, muted) VALUES (${follower.lower}, ${trader.lower})`,
      () => h.db`DELETE FROM mutes WHERE muter = ${follower.lower} AND muted = ${trader.lower}`,
    ],
    [
      "actor block",
      () => h.db`INSERT INTO blocks (blocker, blocked) VALUES (${trader.lower}, ${follower.lower})`,
      () => h.db`DELETE FROM blocks WHERE blocker = ${trader.lower} AND blocked = ${follower.lower}`,
    ],
    [
      "recipient block",
      () => h.db`INSERT INTO blocks (blocker, blocked) VALUES (${follower.lower}, ${trader.lower})`,
      () => h.db`DELETE FROM blocks WHERE blocker = ${follower.lower} AND blocked = ${trader.lower}`,
    ],
    [
      "moderation hide",
      () => h.db`UPDATE profiles SET hidden = true WHERE address = ${trader.lower}`,
      () => h.db`UPDATE profiles SET hidden = false WHERE address = ${trader.lower}`,
    ],
    [
      "sharing off",
      () => h.db`UPDATE profiles SET public_trades_practice = false WHERE address = ${trader.lower}`,
      () => h.db`UPDATE profiles SET public_trades_practice = true WHERE address = ${trader.lower}`,
    ],
    [
      "sharing restarted",
      () =>
        h.db`UPDATE profiles SET public_trades_practice_since = ${new Date((at + 1) * MS_PER_SECOND)} WHERE address = ${trader.lower}`,
      () =>
        h.db`UPDATE profiles SET public_trades_practice_since = ${new Date((at - 1) * MS_PER_SECOND)} WHERE address = ${trader.lower}`,
    ],
  ];
  for (const [name, change, restore] of cases) {
    await change();
    await h.db`UPDATE push_sends SET next_attempt_at = now() WHERE event_key = ${item.id}`;
    const outcome = await delivery.deliverNow(item.id);
    c.record(
      `followed privacy: ${name} suppresses delivery and hides inbox copy`,
      outcome === "no_device" && messages.length === 1 && (await inbox()).length === 0,
    );
    await restore();
  }
}
