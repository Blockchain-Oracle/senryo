import { randomBytes, randomUUID } from "node:crypto";
import {
  type AppNotification,
  followRoute,
  likeRoute,
  muteRoute,
  notificationsListRoute,
  notificationsReadRoute,
  postCreateRoute,
  unlikeRoute,
} from "@senryo/api-client";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { MS_PER_SECOND, notifyArrival, notifyCardEvent, recordNotification } from "@senryo/service-common";
import { notifyFollowersOpened } from "../../src/social/notify.ts";
import { notifyStarterCredit } from "../../src/starter.ts";
import { fill, member, nowSec, usd } from "../social-checks/seed.ts";
import { type Checks, codeOf, type Harness, type User } from "../social-harness.ts";
import { addToken } from "./tokens.ts";

const T: ChainId = TESTNET_CHAIN_ID;
const PAGE = 2;
const STALE_FILL_MS = 3_600_000;
/** Alice's inbox after the social round: reply, like, follow, and the keeper-style fill. */
const ALICE_ROWS = 4;
const AUSD = { address: "0x00000000efe302beaa2b3e6e1b18d08d69a9012a" as const, symbol: "AUSD", decimals: 6 };
const ARRIVED_DOLLARS = 20;
const STARTER_DOLLARS = 1_000;
const TX_HASH_BYTES = 32;
const LOG_INDEX = 3;

async function inbox(u: User): Promise<AppNotification[]> {
  return (await u.api.call(notificationsListRoute, { query: { chainId: T } })).items;
}

/** insert → list → read, through the real routes; social rows only where the recipient may see the actor. */
export async function inboxChecks(h: Harness, c: Checks): Promise<void> {
  const alice = await member(h);
  const bob = await member(h);
  const carol = await member(h);

  const key = `check:fill:${randomUUID()}`;
  const fillPush = {
    chainId: T,
    eventKey: key,
    user: alice.lower,
    channel: "fills" as const,
    title: "Practice · Stop loss closed your Gold long",
    body: "It filled at $4,100.00.",
    url: `senryo://positions/0?chainId=${T}`,
    subject: { kind: "market" as const, marketId: "ours-0" },
  };
  const first = await recordNotification(h.db, fillPush);
  const second = await recordNotification(h.db, fillPush);
  c.record("record: an event is recorded once (the dedupe key)", first && !second, { first, second });
  // A pre-0009 row (no title) never shows.
  await h.db`INSERT INTO push_sends (event_key, user_address, channel, chain_id)
             VALUES (${`${T}:check:legacy:${randomUUID()}`}, ${alice.lower}, 'fills', ${T})`;

  await bob.api.call(followRoute, { params: { address: alice.address } });
  await bob.api.call(followRoute, { params: { address: alice.address } });
  const thesis = await alice.api.call(postCreateRoute, {
    body: { chainId: T, kind: "thesis", text: "Gold holds $4,000 into the close." },
  });
  await bob.api.call(likeRoute, { params: { id: thesis.id } });
  await bob.api.call(unlikeRoute, { params: { id: thesis.id } });
  await bob.api.call(likeRoute, { params: { id: thesis.id } });
  await alice.api.call(likeRoute, { params: { id: thesis.id } });
  await bob.api.call(postCreateRoute, {
    body: { chainId: T, kind: "reply", parentId: thesis.id, text: "Agreed:\n the bid is strong." },
  });
  await alice.api.call(muteRoute, { params: { address: carol.address } });
  await carol.api.call(followRoute, { params: { address: alice.address } });
  await carol.api.call(likeRoute, { params: { id: thesis.id } });

  const page = await alice.api.call(notificationsListRoute, { query: { chainId: T } });
  const kinds = page.items.map((n) => n.channel);
  c.record(
    "list: reply, like, follow, fill — newest first; the untitled legacy row is left out",
    kinds.join(",") === "social,social,social,fills" &&
      /replied to your thesis$/.test(page.items[0]?.title ?? "") &&
      /liked your thesis$/.test(page.items[1]?.title ?? "") &&
      /^Practice · @chk_[0-9a-f]+ followed you$/.test(page.items[2]?.title ?? ""),
    page.items.map((n) => n.title),
  );
  const [reply, like, follow, stored] = page.items;
  c.record(
    "list: links open the thread / profile in Practice; subjects carry the actor's address",
    reply?.url === `senryo://social/post/${thesis.id}?chainId=${T}` &&
      reply.body === "“Agreed: the bid is strong.”" &&
      like?.body === "“Gold holds $4,000 into the close.”" &&
      follow?.url === `senryo://watch/${bob.lower}?chainId=${T}` &&
      follow.subject?.kind === "person" &&
      follow.subject.address === bob.address &&
      stored?.subject?.kind === "market" &&
      stored.id === `${T}:${key}`,
    { reply, like, follow, stored },
  );
  const likes = page.items.filter((n) => n.title.endsWith("liked your thesis")).length;
  const fromCarol = page.items.some((n) => n.subject?.kind === "person" && n.subject.address === carol.address);
  c.record(
    "social: re-liking and re-following notify once; a self-like and a muted account notify nothing",
    likes === 1 && page.items.length === ALICE_ROWS && !fromCarol,
    { likes, fromCarol, n: page.items.length },
  );
  c.record("list: unread counts every unread row", page.unread === ALICE_ROWS, page.unread);

  const p1 = await alice.api.call(notificationsListRoute, { query: { chainId: T, limit: PAGE } });
  const p2 = await alice.api.call(notificationsListRoute, {
    query: { chainId: T, limit: PAGE, cursor: p1.nextCursor ?? undefined },
  });
  const paged = [...p1.items, ...p2.items].map((n) => n.id);
  c.record(
    "list: the cursor pages without gaps or repeats",
    paged.join() === page.items.map((n) => n.id).join() && p2.nextCursor === null && p1.nextCursor !== null,
    { paged, next: p2.nextCursor },
  );
  const wrongNetwork = await codeOf(alice.api.call(notificationsListRoute, { query: { chainId: MAINNET_CHAIN_ID } }));
  const onMainnet = await h.on(alice, MAINNET_CHAIN_ID).api.call(notificationsListRoute, {
    query: { chainId: MAINNET_CHAIN_ID },
  });
  c.record(
    "list: a Practice session can't read Mainnet; Mainnet's inbox is separate",
    wrongNetwork === "FORBIDDEN" && onMainnet.items.length === 0 && onMainnet.unread === 0,
    { wrongNetwork, mainnet: onMainnet.items.length },
  );

  const one = await alice.api.call(notificationsReadRoute, { body: { chainId: T, ids: [reply?.id ?? ""] } });
  const repeat = await alice.api.call(notificationsReadRoute, { body: { chainId: T, ids: [reply?.id ?? ""] } });
  const byBob = await bob.api.call(notificationsReadRoute, { body: { chainId: T, ids: [like?.id ?? ""] } });
  const afterOne = await inbox(alice);
  c.record(
    "read: by id marks once, answers the new unread, and never reaches another account's rows",
    one.updated === 1 &&
      one.unread === ALICE_ROWS - 1 &&
      repeat.updated === 0 &&
      byBob.updated === 0 &&
      afterOne[0]?.readAt !== null &&
      afterOne[1]?.readAt === null,
    { one, repeat, byBob },
  );
  // `before` is the newest createdAt on screen (ms); the row itself is stored in µs and must count as seen.
  const all = await alice.api.call(notificationsReadRoute, { body: { chainId: T, before: reply?.createdAt ?? "" } });
  c.record(
    "read: before the newest createdAt marks everything",
    all.updated === ALICE_ROWS - 1 && all.unread === 0,
    all,
  );

  await hookChecks(h, c);
  await followedTradeChecks(h, c);
}

/** The card sender, the arrival hook and starter money record the right row, once. */
async function hookChecks(h: Harness, c: Checks): Promise<void> {
  const dave = h.user();
  const authId = randomUUID();
  const notice = {
    kind: "declined" as const,
    ref: authId,
    authId,
    merchant: "Blue Bottle",
    amountUsd6: 4_500_000n,
    reason: "frozen" as const,
  };
  const card = await notifyCardEvent(h.db, T, dave.lower, notice);
  const cardAgain = await notifyCardEvent(h.db, T, dave.lower, notice);
  const ref = `0x${randomBytes(TX_HASH_BYTES).toString("hex")}:${LOG_INDEX}`;
  await notifyArrival(h.db, T, dave.lower, AUSD, usd(ARRIVED_DOLLARS), ref);
  const credit = usd(STARTER_DOLLARS);
  const claim = { id: randomUUID(), kind: "claim" as const, chainId: T, user: dave.lower, creditUsd6: credit };
  await notifyStarterCredit(h.db, claim);
  const topUp = await notifyStarterCredit(h.db, { ...claim, id: randomUUID(), kind: "topup" });
  const [starter, arrival, declined] = await inbox(dave);
  c.record(
    "card: a decline names the merchant, the amount and the reason, opens the payment, once",
    card &&
      !cardAgain &&
      declined?.channel === "card" &&
      declined.title === "Practice · Card declined at Blue Bottle" &&
      declined.body === "P$4.50: Your card is frozen. Unfreeze it to pay." &&
      declined.url === `senryo://card/auth/${authId}?chainId=${T}` &&
      declined.subject?.kind === "card",
    declined,
  );
  c.record(
    "money: an arrival shows the exact amount and the token; starter money says P$; gas top-ups aren't news",
    arrival?.channel === "deposits" &&
      arrival.title === "Practice · 20 AUSD arrived" &&
      arrival.subject?.kind === "token" &&
      starter?.title === "Practice · P$1,000.00 has arrived" &&
      !topUp,
    { arrival, starter, topUp },
  );
}

/** "A trader you follow opened a position": only opted-in followers who haven't muted them, fresh fills, once. */
async function followedTradeChecks(h: Harness, c: Checks): Promise<void> {
  const trader = await member(h);
  const optedIn = await member(h);
  const defaults = await member(h);
  const muter = await member(h);
  for (const u of [optedIn, defaults, muter]) await u.api.call(followRoute, { params: { address: trader.address } });
  await addToken(h, optedIn, "ios", { ch_followed_trades: true });
  await addToken(h, defaults, "ios");
  await addToken(h, muter, "ios", { ch_followed_trades: true });
  await muter.api.call(muteRoute, { params: { address: trader.address } });
  // The poller writes only fills at or after the moment the trader turned sharing on (whole seconds, rounded up).
  const [shared] = await h.db<{ since: Date }[]>`
    SELECT public_trades_practice_since AS since FROM profiles WHERE address = ${trader.lower}`;
  const at = Math.max(nowSec(), Math.ceil((shared?.since.getTime() ?? 0) / MS_PER_SECOND));
  fill(h, { user: trader, kind: "OPEN", side: "LONG", at });
  await h.poller.pollChain(T);
  await h.poller.pollChain(T);
  const opened = (await inbox(optedIn)).filter((n) => n.channel === "followedTrades");
  const others = [...(await inbox(defaults)), ...(await inbox(muter))].filter((n) => n.channel === "followedTrades");
  c.record(
    "followed trades: the opted-in follower hears it once; default-off and muting followers don't",
    opened.length === 1 &&
      /^Practice · @chk_[0-9a-f]+ opened a long on XAU$/.test(opened[0]?.title ?? "") &&
      opened[0]?.subject?.kind === "person" &&
      opened[0].subject.marketId === "ours-0" &&
      others.length === 0,
    { opened, others: others.length },
  );
  const stale = await notifyFollowersOpened(h.db, T, [
    {
      id: BigInt(Date.now()),
      actor: trader.lower,
      marketId: "ours-0",
      side: "SHORT",
      symbol: "XAU",
      occurredAt: new Date(Date.now() - STALE_FILL_MS),
    },
  ]);
  c.record("followed trades: an old fill (a backfill) notifies nobody", stale === 0, stale);
}
