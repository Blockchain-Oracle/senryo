/**
 * Posts and moderation (S12b.6): listing + content filter + budget on posts, one-level replies, likes, weighted
 * reports that only queue, an operator `hide` that needs the weight (and auto-hides when it arrives), `keep`, and
 * block / mute effects (follows removed both ways, replies/likes refused, feed filtered).
 */
import { randomUUID } from "node:crypto";
import {
  blockRoute,
  blocksRoute,
  feedRoute,
  followRoute,
  likeRoute,
  muteRoute,
  POST_MAX_CHARS,
  postCreateRoute,
  postCreateSchema,
  postReportRoute,
  profileGetRoute,
  profileReportRoute,
  reviewQueueRoute,
  reviewRoute,
  threadRoute,
  unblockRoute,
  unlikeRoute,
  unmuteRoute,
} from "@senryo/api-client";
import { MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { HTTP_STATUS } from "@senryo/service-common";
import { ADMIN_SECRET_MIN_BYTES, POSTS_PER_HOUR, REPORT_REVIEW_WEIGHT } from "../../src/social/constants.ts";
import { type Checks, codeOf, type Harness, type User } from "../social-harness.ts";
import { claimed, member, position, usd } from "./seed.ts";

const UNTRUSTED_REPORTERS = 5;
/** Long enough to pass the length bar, never the real secret. */
const WRONG_SECRET = "x".repeat(ADMIN_SECRET_MIN_BYTES);
const report = (u: User, id: string) => u.api.call(postReportRoute, { params: { id }, body: { reason: "spam" } });
const thesis = (u: User, text: string, extra: { positionId?: string; marketId?: string } = {}) =>
  u.api.call(postCreateRoute, { body: { chainId: TESTNET_CHAIN_ID, kind: "thesis", text, ...extra } });
const thread = (u: User | undefined, h: Harness, id: string) =>
  (u?.api ?? h.anon).call(threadRoute, { params: { id }, query: { chainId: TESTNET_CHAIN_ID } });
const feedIds = async (u: User) =>
  (await u.api.call(feedRoute, { query: { chainId: TESTNET_CHAIN_ID, scope: "global" } })).items.flatMap((i) =>
    i.post ? [i.post.id] : [],
  );

async function trustedReporters(h: Harness, n: number): Promise<User[]> {
  const out: User[] = [];
  for (let i = 0; i < n; i += 1) {
    const u = h.user();
    await claimed(h, u);
    out.push(u);
  }
  return out;
}

export async function moderationChecks(h: Harness, checks: Checks): Promise<void> {
  // ── Posting rules ───────────────────────────────────────────────────────────────────────────────────────────
  const author = await member(h);
  const mainnetPost = await codeOf(
    author.api.call(postCreateRoute, { body: { chainId: MAINNET_CHAIN_ID, kind: "thesis", text: "gold to the moon" } }),
  );
  checks.record("post: unlisted on mainnet → NOT_LISTED", mainnetPost === "NOT_LISTED", mainnetPost);
  checks.record("post: content filter", (await codeOf(thesis(author, "this is sh!t"))) === "CONTENT_BLOCKED");
  const tooLong = postCreateSchema.safeParse({
    chainId: TESTNET_CHAIN_ID,
    kind: "thesis",
    text: "x".repeat(POST_MAX_CHARS + 1),
  });
  checks.record("post: > 280 characters refused by the shared schema", !tooLong.success);
  const post = await thesis(author, "  Gold breaks out above the range  ");
  checks.record(
    "post: thesis stored trimmed",
    post.text === "Gold breaks out above the range" && post.kind === "thesis",
  );
  const other = await member(h);
  const theirs = position(h, { user: other, pnl: usd(1), notional: usd(10) });
  const stolen = await codeOf(thesis(author, "my trade", { positionId: theirs.id }));
  checks.record("post: someone else's position refused", stolen === "FORBIDDEN", stolen);
  const mine = position(h, { user: author, pnl: usd(1), notional: usd(10) });
  const withPos = await thesis(author, "my trade", { positionId: mine.id });
  checks.record(
    "post: own position attaches its market",
    withPos.marketId === "ours-0" && withPos.positionId === mine.id,
  );

  const reply = await other.api.call(postCreateRoute, {
    body: { chainId: TESTNET_CHAIN_ID, kind: "reply", parentId: post.id, text: "agreed" },
  });
  const nested = await codeOf(
    author.api.call(postCreateRoute, {
      body: { chainId: TESTNET_CHAIN_ID, kind: "reply", parentId: reply.id, text: "nested" },
    }),
  );
  checks.record("reply: one level only (reply to a reply refused)", nested === "BAD_REQUEST", nested);
  const t = await thread(undefined, h, post.id);
  checks.record("thread: thesis with its reply", t.replies.length === 1 && t.post.replies === 1, t);
  const liked = await other.api.call(likeRoute, { params: { id: post.id } });
  const again = await other.api.call(likeRoute, { params: { id: post.id } });
  const unliked = await other.api.call(unlikeRoute, { params: { id: post.id } });
  checks.record(
    "like: idempotent, unlike",
    liked.likes === 1 && again.likes === 1 && !unliked.liked && unliked.likes === 0,
  );

  const spammer = await member(h);
  const seeds = Array.from({ length: POSTS_PER_HOUR }, (_, i) => ({
    id: randomUUID(),
    chain_id: TESTNET_CHAIN_ID,
    author: spammer.lower,
    kind: "thesis",
    text: `seed ${i}`,
  }));
  await h.db`INSERT INTO posts ${h.db(seeds)}`;
  checks.record("post: hourly budget → RATE_LIMITED", (await codeOf(thesis(spammer, "one more"))) === "RATE_LIMITED");

  // ── Reports: weight queues, only weight AND an operator `hide` hides ──────────────────────────────────────
  const target = await thesis(author, "a thesis people will report");
  for (let i = 0; i < UNTRUSTED_REPORTERS; i += 1) await report(h.user(), target.id);
  const queueOf = async (status: "queued" | "open") =>
    (
      (await h.admin(reviewQueueRoute, { query: { status } })).json as {
        items: Array<{ targetId: string; weight: number }>;
      }
    ).items;
  const untrusted = (await queueOf("open")).find((i) => i.targetId === target.id);
  checks.record(
    `report: ${UNTRUSTED_REPORTERS} untrusted reports weigh 0 and don't queue`,
    untrusted?.weight === 0 && !(await queueOf("queued")).some((i) => i.targetId === target.id),
    untrusted,
  );
  const trusted = await trustedReporters(h, REPORT_REVIEW_WEIGHT);
  for (const u of trusted) await report(u, target.id);
  await report(trusted[0] as User, target.id);
  const queued = (await queueOf("queued")).find((i) => i.targetId === target.id);
  checks.record(
    "report: trusted weight reaches the bar → queued (repeat is idempotent)",
    queued?.weight === REPORT_REVIEW_WEIGHT,
    queued,
  );
  checks.record("report: weight alone doesn't hide", (await codeOf(thread(undefined, h, target.id))) === "OK");
  const reporterFeed = await feedIds(trusted[1] as User);
  checks.record("report: the reporter no longer sees it", !reporterFeed.includes(target.id));
  const noSecret = await h.admin(
    reviewRoute,
    { body: { targetKind: "post", targetId: target.id, decision: "hide" } },
    WRONG_SECRET,
  );
  checks.record("review: wrong operator secret → 401", noSecret.status === HTTP_STATUS.unauthorized, noSecret.status);
  const hide = await h.admin(reviewRoute, { body: { targetKind: "post", targetId: target.id, decision: "hide" } });
  checks.record("review: hide with weight → hidden", (hide.json as { hidden?: boolean }).hidden === true, hide.json);
  checks.record("review: hidden thesis is 404", (await codeOf(thread(undefined, h, target.id))) === "NOT_FOUND");
  checks.record(
    "review: hidden thesis leaves the queue",
    !(await queueOf("queued")).some((i) => i.targetId === target.id),
  );
  const kept = await h.admin(reviewRoute, { body: { targetKind: "post", targetId: target.id, decision: "keep" } });
  checks.record(
    "review: keep un-hides",
    (kept.json as { hidden?: boolean }).hidden === false && (await codeOf(thread(undefined, h, target.id))) === "OK",
  );

  const flagged = await thesis(author, "pre-flagged by an operator");
  await h.admin(reviewRoute, { body: { targetKind: "post", targetId: flagged.id, decision: "hide" } });
  checks.record(
    "review: hide without weight doesn't hide yet",
    (await codeOf(thread(undefined, h, flagged.id))) === "OK",
  );
  for (const u of await trustedReporters(h, REPORT_REVIEW_WEIGHT)) await report(u, flagged.id);
  checks.record(
    "review: weight arriving after `hide` auto-hides",
    (await codeOf(thread(undefined, h, flagged.id))) === "NOT_FOUND",
  );
  checks.record("report: own post refused", (await codeOf(report(author, post.id))) === "BAD_REQUEST");

  const troll = await member(h);
  for (const u of await trustedReporters(h, REPORT_REVIEW_WEIGHT)) {
    await u.api.call(profileReportRoute, { params: { address: troll.address }, body: { reason: "harassment" } });
  }
  await h.admin(reviewRoute, { body: { targetKind: "profile", targetId: troll.address, decision: "hide" } });
  const trollLookup = await codeOf(
    h.anon.call(profileGetRoute, { params: { handleOrAddress: troll.address }, query: { chainId: TESTNET_CHAIN_ID } }),
  );
  checks.record("review: hidden profile reads as absent", trollLookup === "NOT_FOUND", trollLookup);

  // ── Block and mute ─────────────────────────────────────────────────────────────────────────────────────────
  const a = await member(h);
  const b = await member(h);
  await a.api.call(followRoute, { params: { address: b.address } });
  await b.api.call(followRoute, { params: { address: a.address } });
  const aPost = await thesis(a, "a's thesis");
  const blocked = await a.api.call(blockRoute, { params: { address: b.address } });
  const [left] = await h.db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM follows WHERE (follower = ${a.lower} AND followee = ${b.lower})
                                            OR (follower = ${b.lower} AND followee = ${a.lower})`;
  checks.record("block: removes follows both ways", blocked.blocked && left?.n === 0, left);
  checks.record(
    "block: blocked can't like",
    (await codeOf(b.api.call(likeRoute, { params: { id: aPost.id } }))) === "BLOCKED",
  );
  const blockedReply = await codeOf(
    b.api.call(postCreateRoute, {
      body: { chainId: TESTNET_CHAIN_ID, kind: "reply", parentId: aPost.id, text: "hey" },
    }),
  );
  checks.record("block: blocked can't reply", blockedReply === "BLOCKED", blockedReply);
  checks.record("block: hidden both ways in the feed", !(await feedIds(b)).includes(aPost.id));
  const list = await a.api.call(blocksRoute, { query: {} });
  checks.record(
    "block: listed in my blocks",
    list.items.some((i) => i.address === b.address),
  );
  checks.record(
    "block: self refused",
    (await codeOf(a.api.call(blockRoute, { params: { address: a.address } }))) === "BAD_REQUEST",
  );
  await a.api.call(unblockRoute, { params: { address: b.address } });
  checks.record(
    "block: unblock restores follow",
    (await codeOf(b.api.call(followRoute, { params: { address: a.address } }))) === "OK",
  );

  const c = await member(h);
  const cPost = await thesis(c, "c's thesis");
  await a.api.call(muteRoute, { params: { address: c.address } });
  checks.record(
    "mute: hides from my feed only",
    !(await feedIds(a)).includes(cPost.id) && (await feedIds(b)).includes(cPost.id),
  );
  await a.api.call(unmuteRoute, { params: { address: c.address } });
  checks.record("mute: unmute restores", (await feedIds(a)).includes(cPost.id));
}
