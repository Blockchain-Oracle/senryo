/**
 * Trade posts (F-D1, migration 0011): a feed trade row takes every post verb through a post created on first use.
 * Zero engagement before anyone acts; one post per row whoever asks; likes, replies and the thread through the
 * existing routes; the trade in its thread; pushes worded for a trade; never deletable by the trader; a thesis row is
 * its own post; a report hides the row for the reporter only; a block refuses the like; sharing off hides it all.
 */
import {
  blockRoute,
  type FeedItem,
  feedRoute,
  likeRoute,
  postCreateRoute,
  postDeleteRoute,
  postReportRoute,
  profilePutRoute,
  threadRoute,
  tradeAnchorRoute,
} from "@senryo/api-client";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { type Checks, codeOf, type Harness, type User } from "../social-harness.ts";
import { sharingStart } from "./feed.ts";
import { fill, member, XAU } from "./seed.ts";

const chainId = TESTNET_CHAIN_ID;

async function rowOf(h: Harness, u: User | undefined, id: string): Promise<FeedItem | undefined> {
  const page = await (u?.api ?? h.anon).call(feedRoute, { query: { chainId, scope: "global" } });
  return page.items.find((item) => item.id === id);
}

export async function tradePostChecks(h: Harness, checks: Checks): Promise<void> {
  const [trader, fan, critic] = [await member(h), await member(h), await member(h)];
  const opened = fill(h, { user: trader, kind: "OPEN", market: XAU, at: await sharingStart(h, trader) });
  await h.poller.pollChain(chainId);
  const page = await h.anon.call(feedRoute, { query: { chainId, scope: "global" } });
  const row = page.items.find((item) => item.trade?.txHash === opened.txHash);
  checks.record(
    "trade posts: a trade row starts with zero engagement and no post; thesis rows carry none",
    row?.engagement?.postId === null &&
      row.engagement.likes === 0 &&
      row.engagement.replies === 0 &&
      !row.engagement.likedByMe &&
      page.items.filter((i) => i.kind === "thesis").every((i) => i.engagement === null),
    row?.engagement,
  );
  if (!row) return;

  const anchor = await fan.api.call(tradeAnchorRoute, { params: { id: row.id } });
  const again = await h.anon.call(tradeAnchorRoute, { params: { id: row.id } });
  checks.record(
    "trade posts: one post per row whoever asks (kind trade, by the trader, on the row's market)",
    anchor.kind === "trade" &&
      again.id === anchor.id &&
      anchor.author.address === trader.address &&
      anchor.marketId === XAU.id &&
      anchor.text === "",
    { anchor, again: again.id },
  );

  await fan.api.call(likeRoute, { params: { id: anchor.id } });
  const reply = await fan.api.call(postCreateRoute, {
    body: { chainId, kind: "reply", parentId: anchor.id, text: "Clean entry" },
  });
  const seen = await rowOf(h, fan, row.id);
  const anon = await rowOf(h, undefined, row.id);
  checks.record(
    "trade posts: likes and replies land on the row (liked by me only for the liker)",
    seen?.engagement?.postId === anchor.id &&
      seen.engagement.likes === 1 &&
      seen.engagement.replies === 1 &&
      seen.engagement.likedByMe &&
      anon?.engagement?.likedByMe === false,
    { seen: seen?.engagement, anon: anon?.engagement },
  );
  const thread = await h.anon.call(threadRoute, { params: { id: anchor.id }, query: { chainId } });
  checks.record(
    "trade posts: the thread carries the trade and its replies",
    thread.trade?.txHash === opened.txHash && thread.replies[0]?.id === reply.id && thread.post.replies === 1,
    thread,
  );
  const pushes = await h.db<{ title: string }[]>`
    SELECT title FROM push_sends WHERE user_address = ${trader.lower}`;
  checks.record(
    'trade posts: the trader is told "liked your trade" and "replied to your trade"',
    pushes.some((p) => p.title.endsWith("liked your trade")) &&
      pushes.some((p) => p.title.endsWith("replied to your trade")),
    pushes,
  );
  const deleted = await trader.api.call(postDeleteRoute, { params: { id: anchor.id } });
  checks.record("trade posts: the trader can't delete a trade (it is onchain)", !deleted.deleted, deleted);

  const thesis = await trader.api.call(postCreateRoute, { body: { chainId, kind: "thesis", text: "Gold runs" } });
  const thesisRow = (await h.anon.call(feedRoute, { query: { chainId, scope: "global" } })).items.find(
    (i) => i.post?.id === thesis.id,
  );
  const thesisAnchor = thesisRow
    ? await codeOf(h.anon.call(tradeAnchorRoute, { params: { id: thesisRow.id } }))
    : "missing";
  checks.record("trade posts: a thesis row is its own post (404)", thesisAnchor === "NOT_FOUND", thesisAnchor);

  await critic.api.call(postReportRoute, { params: { id: anchor.id }, body: { reason: "spam" } });
  checks.record(
    "trade posts: a report hides the row for the reporter only",
    (await rowOf(h, critic, row.id)) === undefined && (await rowOf(h, fan, row.id)) !== undefined,
  );

  await trader.api.call(blockRoute, { params: { address: fan.address } });
  const refused = await codeOf(fan.api.call(likeRoute, { params: { id: anchor.id } }));
  checks.record("trade posts: a block refuses the like", refused === "BLOCKED", refused);

  await trader.api.call(profilePutRoute, { body: { publicTradesPractice: false } });
  const gone = await codeOf(h.anon.call(threadRoute, { params: { id: anchor.id }, query: { chainId } }));
  const noAnchor = await codeOf(h.anon.call(tradeAnchorRoute, { params: { id: row.id } }));
  checks.record(
    "trade posts: sharing off hides the thread and refuses a new post",
    gone === "NOT_FOUND" && noAnchor === "NOT_FOUND",
    { gone, noAnchor },
  );
}
