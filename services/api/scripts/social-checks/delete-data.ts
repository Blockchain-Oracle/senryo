/**
 * Delete my data (S12b.8, A9): every social row the account owns goes — profile, follows both ways, its blocks and
 * mutes, its posts (with replies, likes and feed rows), its likes, its reports and reports about its posts, its feed
 * rows — and so do its price alerts, push tokens (with their tickets), backup vaults, inbox watches and prefs; its
 * notifications lose their content and its analytics events their address (defect 10). The handle hold (Q-022
 * default), other accounts' blocks / mutes of it and reports about its profile stay.
 */
import { randomUUID } from "node:crypto";
import {
  blockRoute,
  followRoute,
  handleAvailableRoute,
  likeRoute,
  muteRoute,
  postCreateRoute,
  postReportRoute,
  profileReportRoute,
  socialDeleteRoute,
} from "@senryo/api-client";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import type { Checks, Harness, User } from "../social-harness.ts";
import { member } from "./seed.ts";

const thesis = (u: User, text: string) =>
  u.api.call(postCreateRoute, { body: { chainId: TESTNET_CHAIN_ID, kind: "thesis", text } });
const replyTo = (u: User, parentId: string) =>
  u.api.call(postCreateRoute, { body: { chainId: TESTNET_CHAIN_ID, kind: "reply", parentId, text: "reply" } });
/** Rows a query returns (each check selects `1` per matching row). */
const rows = async (query: PromiseLike<ArrayLike<unknown>>): Promise<number> => (await query).length;
const EXPECTED_FOLLOWS = 2;

export async function deleteDataChecks(h: Harness, checks: Checks): Promise<void> {
  const d = await member(h);
  const x = await member(h);
  const y = await member(h);
  const z = await member(h);
  const [handleRow] = await h.db<{ handle: string }[]>`SELECT handle FROM profiles WHERE address = ${d.lower}`;
  const handle = handleRow?.handle ?? "";

  await d.api.call(followRoute, { params: { address: z.address } });
  await z.api.call(followRoute, { params: { address: d.address } });
  await d.api.call(blockRoute, { params: { address: x.address } });
  await y.api.call(blockRoute, { params: { address: d.address } });
  await d.api.call(muteRoute, { params: { address: y.address } });
  await x.api.call(muteRoute, { params: { address: d.address } });
  const dThesis = await thesis(d, "d's thesis");
  const zThesis = await thesis(z, "z's thesis");
  const zReply = await replyTo(z, dThesis.id);
  await replyTo(d, zThesis.id);
  await d.api.call(likeRoute, { params: { id: zThesis.id } });
  await z.api.call(likeRoute, { params: { id: dThesis.id } });
  await z.api.call(postReportRoute, { params: { id: dThesis.id }, body: { reason: "spam" } });
  await d.api.call(profileReportRoute, { params: { address: x.address }, body: { reason: "spam" } });
  await x.api.call(profileReportRoute, { params: { address: d.address }, body: { reason: "impersonation" } });
  await h.db`
    INSERT INTO feed_events (chain_id, source_id, kind, actor, occurred_at)
    VALUES (${TESTNET_CHAIN_ID}, ${`fill:check-${d.lower}`}, 'fill', ${d.lower}, now())`;

  await seedAccountRows(h, d.lower);
  const result = await d.api.call(socialDeleteRoute, {});
  const me = d.lower;
  const left = {
    profile: await rows(h.db`SELECT 1 FROM profiles WHERE address = ${me}`),
    follows: await rows(h.db`SELECT 1 FROM follows WHERE follower = ${me} OR followee = ${me}`),
    blocks: await rows(h.db`SELECT 1 FROM blocks WHERE blocker = ${me}`),
    mutes: await rows(h.db`SELECT 1 FROM mutes WHERE muter = ${me}`),
    posts: await rows(h.db`SELECT 1 FROM posts WHERE author = ${me}`),
    repliesToMine: await rows(h.db`SELECT 1 FROM posts WHERE id = ${zReply.id}`),
    myLikes: await rows(h.db`SELECT 1 FROM likes WHERE address = ${me}`),
    likesOnMine: await rows(h.db`SELECT 1 FROM likes WHERE post_id = ${dThesis.id}`),
    reports: await rows(h.db`SELECT 1 FROM reports WHERE reporter = ${me} OR target_id = ${dThesis.id}`),
    feed: await rows(h.db`SELECT 1 FROM feed_events WHERE actor = ${me} OR post_id = ${dThesis.id}`),
  };
  checks.record(
    "delete: profile, follows, own blocks/mutes, posts (+ replies, likes), likes, reports, feed rows — none left",
    Object.values(left).every((n) => n === 0),
    left,
  );
  const account = await accountRowsLeft(h, me);
  checks.record(
    "delete: alerts, push tokens + tickets, vaults, inbox watches, prefs gone; notifications and events unlinked",
    Object.values(account).every((n) => n === 0),
    account,
  );
  checks.record(
    "delete: the response counts what went",
    result.deleted.profile &&
      result.deleted.follows === EXPECTED_FOLLOWS &&
      result.deleted.blocks === 1 &&
      result.deleted.mutes === 1 &&
      result.deleted.likes === 1 &&
      result.deleted.feedEvents === 1 &&
      result.deleted.alerts === 1 &&
      result.deleted.pushTokens === 1 &&
      result.deleted.vaults === 1 &&
      result.deleted.inboxWatches === 1 &&
      result.deleted.prefs &&
      result.deleted.notifications >= 1,
    result.deleted,
  );
  const kept = {
    othersBlockOfMe: await rows(h.db`SELECT 1 FROM blocks WHERE blocker = ${y.lower} AND blocked = ${me}`),
    othersMuteOfMe: await rows(h.db`SELECT 1 FROM mutes WHERE muter = ${x.lower} AND muted = ${me}`),
    reportAboutMe: await rows(h.db`SELECT 1 FROM reports WHERE target_kind = 'profile' AND target_id = ${me}`),
    zThesis: await rows(h.db`SELECT 1 FROM posts WHERE id = ${zThesis.id}`),
  };
  checks.record(
    "delete: other accounts' blocks, mutes, reports about me and their own posts stay",
    Object.values(kept).every((n) => n === 1),
    kept,
  );
  const held = await h.anon.call(handleAvailableRoute, { params: { h: handle } });
  checks.record(
    "delete: the handle stays held 30 days (Q-022 default)",
    held.state === "held" && result.handleHeldUntil === held.heldUntil,
    { held, result: result.handleHeldUntil },
  );
}

/** One row in each account table "Delete my data" must clear (A9). */
async function seedAccountRows(h: Harness, me: string): Promise<void> {
  const token = `ExponentPushToken[check-${me}]`;
  await h.db`
    INSERT INTO price_alerts (id, user_address, chain_id, market_id, direction, price18)
    VALUES (${randomUUID()}, ${me}, ${TESTNET_CHAIN_ID}, 1, 'above', 1)`;
  await h.db`INSERT INTO push_tokens (token, user_address, platform) VALUES (${token}, ${me}, 'ios')`;
  await h.db`INSERT INTO push_tickets (ticket_id, token, event_key) VALUES (${`ticket-${me}`}, ${token}, 'k')`;
  await h.db`
    INSERT INTO vault_blobs (credential_id, address, vault) VALUES (${`cred-${me}`}, ${me}, ${h.db.json({})})`;
  await h.db`
    INSERT INTO inbox_watches (chain_id, user_address, inbox, expires_at)
    VALUES (${TESTNET_CHAIN_ID}, ${me}, ${me}, now() + interval '1 day')`;
  await h.db`INSERT INTO prefs_blobs (address, blob, version) VALUES (${me}, 'sealed', 1) ON CONFLICT DO NOTHING`;
  await h.db`
    INSERT INTO push_sends (event_key, user_address, channel, chain_id, title, body)
    VALUES (${`check:${me}`}, ${me}, 'fills', ${TESTNET_CHAIN_ID}, 'Filled', 'Your order filled')`;
  await h.db`INSERT INTO events (name, user_address) VALUES ('check', ${me})`;
}

async function accountRowsLeft(h: Harness, me: string) {
  return {
    alerts: await rows(h.db`SELECT 1 FROM price_alerts WHERE user_address = ${me}`),
    pushTokens: await rows(h.db`SELECT 1 FROM push_tokens WHERE user_address = ${me}`),
    tickets: await rows(h.db`SELECT 1 FROM push_tickets WHERE ticket_id = ${`ticket-${me}`}`),
    vaults: await rows(h.db`SELECT 1 FROM vault_blobs WHERE address = ${me}`),
    watches: await rows(h.db`SELECT 1 FROM inbox_watches WHERE user_address = ${me}`),
    prefs: await rows(h.db`SELECT 1 FROM prefs_blobs WHERE address = ${me}`),
    notifications: await rows(h.db`SELECT 1 FROM push_sends WHERE user_address = ${me} AND title IS NOT NULL`),
    events: await rows(h.db`SELECT 1 FROM events WHERE user_address = ${me}`),
  };
}
