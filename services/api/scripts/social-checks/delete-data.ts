/**
 * Delete my data (S12b.8): every social row the account owns goes — profile, follows both ways, its blocks and mutes,
 * its posts (with replies, likes and feed rows), its likes, its reports and reports about its posts, its feed rows —
 * while the handle hold (Q-022 default), other accounts' blocks / mutes of it and reports about its profile stay.
 */
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
  checks.record(
    "delete: the response counts what went",
    result.deleted.profile &&
      result.deleted.follows === EXPECTED_FOLLOWS &&
      result.deleted.blocks === 1 &&
      result.deleted.mutes === 1 &&
      result.deleted.likes === 1 &&
      result.deleted.feedEvents === 1,
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
