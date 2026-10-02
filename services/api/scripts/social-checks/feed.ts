/**
 * Feed (S12b.4) and search (S12b.7): the poller writes only fills of accounts that share that network's trades, made
 * after sharing was turned on; per-network cursors and chain filters; replays are no-ops; kinds stay separate; the
 * global / friends / market scopes; theses merge in; keyset pages; turning sharing off hides at once and turning it
 * back on never republishes. Search: markets per network, handle prefix with `_` taken literally, listing respected.
 */
import { randomBytes } from "node:crypto";
import {
  type FeedItem,
  feedRoute,
  followRoute,
  postCreateRoute,
  profilePutRoute,
  type SearchKind,
  searchRoute,
} from "@senryo/api-client";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { MS_PER_SECOND } from "@senryo/service-common";
import { type Checks, codeOf, type Harness, type User } from "../social-harness.ts";
import { FEED_FIX } from "./constants.ts";
import { fill, member, nowSec, XAG } from "./seed.ts";

const SUFFIX_BYTES = 4;
/** Fills by `s` the poller must write on practice: open, increase, close. */
const SHARED_FILLS = 3;

/** The first whole second at or after `u`'s sharing start on that network (block times are whole seconds). */
async function sharingStart(h: Harness, u: User, chainId: ChainId = TESTNET_CHAIN_ID): Promise<number> {
  const column = chainId === MAINNET_CHAIN_ID ? "public_trades_mainnet_since" : "public_trades_practice_since";
  const [row] = await h.db<{ since: Date }[]>`SELECT ${h.db(column)} AS since FROM profiles WHERE address = ${u.lower}`;
  return Math.ceil((row?.since.getTime() ?? 0) / MS_PER_SECOND);
}

/** Wait until the wall clock has passed `sec` (so a sharing restart lands strictly after earlier fills). */
async function waitPast(sec: number): Promise<void> {
  const wait = (sec + 1) * MS_PER_SECOND - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

async function feedOf(
  h: Harness,
  u: User | undefined,
  query: { scope?: "global" | "friends"; market?: string; chainId?: ChainId } = {},
): Promise<FeedItem[]> {
  const page = await (u?.api ?? h.anon).call(feedRoute, {
    query: {
      chainId: query.chainId ?? TESTNET_CHAIN_ID,
      scope: query.scope ?? "global",
      ...(query.market ? { market: query.market } : {}),
    },
  });
  return page.items;
}

const tradeIds = (items: FeedItem[], u: User) =>
  items.filter((i) => i.trade && i.actor.address === u.address).map((i) => i.trade?.txHash);

export async function feedChecks(h: Harness, checks: Checks): Promise<void> {
  const now = nowSec();
  const s = await member(h);
  const quiet = await member(h, { publicTradesPractice: false });
  const unlisted = await member(h, { listedPractice: false });
  const viewer = await member(h);
  const loner = await member(h);
  await viewer.api.call(followRoute, { params: { address: s.address } });

  const start = await sharingStart(h, s);
  const early = fill(h, { user: s, at: now - FEED_FIX.beforeSharing });
  const opened = fill(h, { user: s, kind: "OPEN", notional: FEED_FIX.notional, at: start });
  const added = fill(h, { user: s, kind: "INCREASE", market: XAG, at: start });
  const closed = fill(h, { user: s, kind: "CLOSE", pnl: FEED_FIX.closePnl, fee: FEED_FIX.closeFee, at: start });
  const quietFill = fill(h, { user: quiet, at: start });
  const unlistedFill = fill(h, { user: unlisted, at: start });
  const mainnetFill = fill(h, { user: s, chainId: MAINNET_CHAIN_ID, at: start });

  const notices = h.notices.length;
  const written = await h.poller.pollChain(TESTNET_CHAIN_ID);
  checks.record("poller: writes only sharers' fills made after sharing started", written === SHARED_FILLS, written);
  checks.record(
    "poller: a replay writes nothing (cursor + unique source id)",
    (await h.poller.pollChain(TESTNET_CHAIN_ID)) === 0,
  );
  const notice = h.notices.slice(notices).find((n) => n.chainId === TESTNET_CHAIN_ID);
  checks.record("poller: emits a feed:{chainId} notice", notice !== undefined && notice.latestId > 0n, notice);
  checks.record(
    "poller: mainnet writes nothing while s doesn't share there",
    (await h.poller.pollChain(MAINNET_CHAIN_ID)) === 0,
  );

  const global = await feedOf(h, undefined);
  const mine = tradeIds(global, s);
  checks.record(
    "feed: newest first; pre-sharing, non-sharing, unlisted and other-network fills absent",
    mine.join() === [closed.txHash, added.txHash, opened.txHash].join() &&
      ![early, quietFill, unlistedFill, mainnetFill].some((f) => global.some((i) => i.trade?.txHash === f.txHash)),
    mine,
  );
  const kinds = global.filter((i) => i.actor.address === s.address).map((i) => i.kind);
  const closeItem = global.find((i) => i.trade?.txHash === closed.txHash);
  checks.record(
    "feed: kinds separate (close/open = position, increase = fill), close carries net PnL",
    kinds.join() === "position,fill,position" &&
      closeItem?.trade?.positionStatus === "CLOSED" &&
      closeItem.trade.positionNetPnl === FEED_FIX.closePnl - FEED_FIX.closeFee,
    { kinds, closeItem },
  );
  checks.record(
    "feed: friends = accounts you follow",
    tradeIds(await feedOf(h, viewer, { scope: "friends" }), s).length === SHARED_FILLS &&
      tradeIds(await feedOf(h, loner, { scope: "friends" }), s).length === 0,
  );
  checks.record(
    "feed: friends needs a session",
    (await codeOf(feedOf(h, undefined, { scope: "friends" }))) === "UNAUTHORIZED",
  );
  checks.record(
    "feed: market filter",
    tradeIds(await feedOf(h, undefined, { market: XAG.id }), s).join() === added.txHash,
  );

  const post = await s.api.call(postCreateRoute, {
    body: { chainId: TESTNET_CHAIN_ID, kind: "thesis", text: "XAU leg two" },
  });
  const withThesis = await feedOf(h, viewer, { scope: "friends" });
  checks.record(
    "feed: theses merge in, newest first",
    withThesis[0]?.post?.id === post.id && withThesis[0].kind === "thesis",
  );
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await viewer.api.call(feedRoute, {
      query: { chainId: TESTNET_CHAIN_ID, scope: "friends", limit: FEED_FIX.page, ...(cursor ? { cursor } : {}) },
    });
    seen.push(...page.items.map((i) => i.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  checks.record(
    "feed: keyset pages cover every row once",
    seen.length === withThesis.length && new Set(seen).size === seen.length,
  );

  const actorPage = await viewer.api.call(feedRoute, {
    query: { chainId: TESTNET_CHAIN_ID, scope: "global", actor: s.address, limit: FEED_FIX.page },
  });
  checks.record(
    "profile feed: actor is filtered before pagination",
    actorPage.items.length > 0 && actorPage.items.every((item) => item.actor.address === s.address),
  );
  const privateActor = await h.anon.call(feedRoute, {
    query: { chainId: TESTNET_CHAIN_ID, scope: "global", actor: unlisted.address },
  });
  checks.record("profile feed: actor does not bypass listing/privacy", privateActor.items.length === 0);
  const actorMainnet = await h.anon.call(feedRoute, {
    query: { chainId: MAINNET_CHAIN_ID, scope: "global", actor: s.address },
  });
  checks.record("profile feed: actor remains network separated", actorMainnet.items.length === 0);

  await waitPast(start);
  await s.api.call(profilePutRoute, { body: { listedMainnet: true, publicTradesMainnet: true } });
  const lateMainnet = fill(h, { user: s, chainId: MAINNET_CHAIN_ID, at: await sharingStart(h, s, MAINNET_CHAIN_ID) });
  await h.poller.pollChain(MAINNET_CHAIN_ID);
  const mainnetItems = await feedOf(h, undefined, { chainId: MAINNET_CHAIN_ID });
  checks.record(
    "feed: per network — mainnet shows only what happened after mainnet sharing began",
    tradeIds(mainnetItems, s).join() === lateMainnet.txHash &&
      tradeIds(await feedOf(h, undefined), s).length === SHARED_FILLS,
  );

  await s.api.call(profilePutRoute, { body: { publicTradesPractice: false } });
  const off = await feedOf(h, undefined);
  checks.record(
    "sharing off: fills vanish at once, theses stay",
    tradeIds(off, s).length === 0 && off.some((i) => i.post?.id === post.id),
  );
  await s.api.call(profilePutRoute, { body: { publicTradesPractice: true } });
  checks.record(
    "sharing back on: earlier fills are not republished",
    tradeIds(await feedOf(h, undefined), s).length === 0,
  );

  await searchChecks(h, checks, s);
}

async function searchChecks(h: Harness, checks: Checks, s: User): Promise<void> {
  const find = (q: string, kind?: SearchKind, chainId: ChainId = TESTNET_CHAIN_ID) =>
    h.anon.call(searchRoute, { query: { chainId, q, ...(kind ? { kind } : {}) } });
  checks.record(
    "search: markets by name",
    (await find("gold", "markets")).markets.map((m) => m.symbol).join() === "XAU",
  );
  checks.record("search: markets by pair", (await find("XAG/usd")).markets.map((m) => m.id).join() === XAG.id);
  checks.record(
    "search: markets per network (FX is on both since AddMarkets run 2, 1 Oct)",
    (await find("eur")).markets[0]?.symbol === "EUR" &&
      (await find("eur", undefined, MAINNET_CHAIN_ID)).markets[0]?.symbol === "EUR",
  );
  const stem = `zq${randomBytes(SUFFIX_BYTES).toString("hex")}`;
  const under = h.user();
  const other = h.user();
  await under.api.call(profilePutRoute, { body: { handle: `${stem}_a` } });
  await other.api.call(profilePutRoute, { body: { handle: `${stem}xa` } });
  const literal = await find(`${stem}_`, "traders");
  checks.record(
    "search: handle prefix treats `_` literally",
    literal.traders.map((t) => t.address).join() === under.address && literal.markets.length === 0,
    literal.traders,
  );
  checks.record(
    "search: @ and capitals normalise",
    (await find(`@${stem.toUpperCase()}`, "traders")).traders.length === 2,
  );
  checks.record(
    "search: unlisted on mainnet → not found there",
    (await find(stem, "traders", MAINNET_CHAIN_ID)).traders.length === 0,
  );
  checks.record("search: exact address", (await find(s.address, "traders")).traders[0]?.address === s.address);
  checks.record(
    "search: tokens from the J11 spot list (MON by symbol, Wrapped BTC by name; USDC is the quote, not listed)",
    (await find("mon")).tokens.some((t) => t.symbol === "MON") &&
      (await find("wrapped b")).tokens.some((t) => t.symbol === "WBTC") &&
      (await find("usdc")).tokens.every((t) => t.symbol !== "USDC"),
  );
}
