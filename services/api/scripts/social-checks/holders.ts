/**
 * Market Holders (FT098) over the mocked indexer: only accounts listed on that network and sharing its trades, largest
 * notional first, notional and price-move P&L at the accepted mark (a short's sign), per network, the viewer's blocks
 * (either way) and mutes, the Friends filter and its session, sharing turned off applying at once under the cache,
 * the cache window itself, 503 when the indexer or the price is unavailable (never an empty list), 404 for a market
 * not listed on the network, and the cap with its `more` count.
 */
import {
  blockRoute,
  followRoute,
  MARKET_HOLDERS_MAX,
  type MarketHolders,
  marketHoldersRoute,
  muteRoute,
  profilePutRoute,
} from "@senryo/api-client";
import { type ChainId, engineMarket, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { ourMarketId } from "@senryo/indexer-client";
import { HOLDERS_CACHE_MS } from "../../src/social/constants.ts";
import { type Checks, codeOf, type Harness, type User } from "../social-harness.ts";
import { HOLDERS_FIX } from "./constants.ts";
import { holding, member, nowSec } from "./seed.ts";

function marketOf(symbol: string) {
  const m = engineMarket(symbol);
  if (!m) throw new Error(`no engine market ${symbol}`);
  return { engineId: m.id, ref: { id: ourMarketId(m.id), symbol } };
}
/** Engine markets no other suite seeds (theirs are XAU / XAG), so this suite's rows are their only holders. */
const MAIN = marketOf("GBP");
const CROWD = marketOf("CHF");
/** Listed, but the harness has no price for it. */
const NO_PRICE = marketOf("CAD");
/** No engine market has this id. */
const UNLISTED_MARKET_ID = 99;

async function holdersOf(
  h: Harness,
  u: User | undefined,
  marketId: number,
  opts: { friends?: boolean; chainId?: ChainId } = {},
): Promise<MarketHolders> {
  return (u?.api ?? h.anon).call(marketHoldersRoute, {
    params: { marketId },
    query: { chainId: opts.chainId ?? TESTNET_CHAIN_ID, friends: opts.friends ?? false },
  });
}

const order = (page: MarketHolders) => page.holders.map((x) => x.address).join();
const ids = (...users: User[]) => users.map((u) => u.lower).join();

export async function holdersChecks(h: Harness, checks: Checks): Promise<void> {
  const fix = HOLDERS_FIX;
  const markAt = nowSec();
  for (const chainId of [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID]) {
    for (const m of [MAIN, CROWD]) h.marks.set(`${chainId}:${m.engineId}`, { price18: fix.mark18, updatedAt: markAt });
  }

  // Listed and sharing on practice (the defaults), except where the update says otherwise.
  const a = await member(h);
  const b = await member(h);
  const c = await member(h);
  const banned = await member(h);
  const blocker = await member(h);
  const blockedBy = await member(h);
  const muter = await member(h);
  const friend = await member(h);
  const quiet = await member(h, { publicTradesPractice: false });
  const unlisted = await member(h, { listedPractice: false });
  await h.db`UPDATE profiles SET hidden = true WHERE address = ${banned.lower}`;
  holding(h, { user: c, market: MAIN.ref, side: "LONG", size: fix.c.size, entry: fix.c.entry });
  holding(h, { user: a, market: MAIN.ref, side: "LONG", size: fix.a.size, entry: fix.a.entry });
  holding(h, { user: b, market: MAIN.ref, side: "SHORT", size: fix.b.size, entry: fix.b.entry });
  const unseen = { market: MAIN.ref, side: "LONG", size: fix.unseen.size, entry: fix.unseen.entry } as const;
  for (const u of [quiet, unlisted, banned]) holding(h, { user: u, ...unseen });
  holding(h, { user: a, chainId: MAINNET_CHAIN_ID, ...unseen });
  await blocker.api.call(blockRoute, { params: { address: b.address } });
  await c.api.call(blockRoute, { params: { address: blockedBy.address } });
  await muter.api.call(muteRoute, { params: { address: a.address } });
  await friend.api.call(followRoute, { params: { address: a.address } });
  await friend.api.call(followRoute, { params: { address: quiet.address } });

  const anon = await holdersOf(h, undefined, MAIN.engineId);
  checks.record(
    "holders: sharing accounts only (not quiet, unlisted or hidden), largest notional first",
    order(anon) === ids(c, a, b),
    order(anon),
  );
  const [hc, ha, hb] = anon.holders;
  checks.record(
    "holders: notional and price-move P&L at the accepted mark (a short gains below its entry)",
    hc?.notionalUsd6 === fix.c.notional &&
      hc.upnlUsd6 === fix.c.upnl &&
      ha?.notionalUsd6 === fix.a.notional &&
      ha.upnlUsd6 === fix.a.upnl &&
      ha.entry18 === fix.a.entry &&
      hb?.isLong === false &&
      hb.size18 === fix.b.size &&
      hb.notionalUsd6 === fix.b.notional &&
      hb.upnlUsd6 === fix.b.upnl,
    anon.holders,
  );
  checks.record(
    "holders: the mark and its time, more = 0, lower-case addresses with the profile's handle",
    anon.mark18 === fix.mark18 &&
      anon.markUpdatedAt === markAt &&
      anon.more === 0 &&
      anon.holders.every((x) => x.address === x.address.toLowerCase() && x.handle !== null),
    { mark18: anon.mark18, markUpdatedAt: anon.markUpdatedAt, more: anon.more },
  );
  checks.record(
    "holders: blocks either way and mutes leave the viewer's list",
    order(await holdersOf(h, blocker, MAIN.engineId)) === ids(c, a) &&
      order(await holdersOf(h, blockedBy, MAIN.engineId)) === ids(a, b) &&
      order(await holdersOf(h, muter, MAIN.engineId)) === ids(c, b),
  );
  checks.record(
    "holders: friends = sharing accounts you follow",
    order(await holdersOf(h, friend, MAIN.engineId, { friends: true })) === ids(a),
  );
  checks.record(
    "holders: friends needs a session",
    (await codeOf(holdersOf(h, undefined, MAIN.engineId, { friends: true }))) === "UNAUTHORIZED",
  );
  const mainnet = await holdersOf(h, undefined, MAIN.engineId, { chainId: MAINNET_CHAIN_ID });
  checks.record("holders: per network (a's mainnet position: not listed there)", mainnet.holders.length === 0, mainnet);

  await a.api.call(profilePutRoute, { body: { publicTradesPractice: false } });
  const stopped = await holdersOf(h, undefined, MAIN.engineId);
  await a.api.call(profilePutRoute, { body: { publicTradesPractice: true } });
  checks.record(
    "holders: turning sharing off hides at once, cache or not",
    order(stopped) === ids(c, b),
    order(stopped),
  );

  const late = await member(h);
  holding(h, { user: late, market: MAIN.ref, side: "LONG", size: fix.late.size, entry: fix.late.entry });
  const cached = await holdersOf(h, undefined, MAIN.engineId);
  h.clock.skewMs += HOLDERS_CACHE_MS;
  const fresh = await holdersOf(h, undefined, MAIN.engineId);
  checks.record(
    "holders: one indexer read per market per cache window, then re-read",
    order(cached) === ids(c, a, b) && order(fresh) === ids(c, a, b, late),
    { cached: order(cached), fresh: order(fresh) },
  );

  h.mock.holdersDown = true;
  h.clock.skewMs += HOLDERS_CACHE_MS;
  const down = await codeOf(holdersOf(h, undefined, MAIN.engineId));
  h.mock.holdersDown = false;
  const held = await codeOf(holdersOf(h, undefined, MAIN.engineId));
  h.clock.skewMs += HOLDERS_CACHE_MS;
  const back = await codeOf(holdersOf(h, undefined, MAIN.engineId));
  checks.record(
    "holders: indexer down → 503 (never an empty list), held for the cache window, then recovers",
    down === "UPSTREAM_UNAVAILABLE" && held === "UPSTREAM_UNAVAILABLE" && back === "OK",
    { down, held, back },
  );
  checks.record(
    "holders: no accepted price → 503",
    (await codeOf(holdersOf(h, undefined, NO_PRICE.engineId))) === "UPSTREAM_UNAVAILABLE",
  );
  checks.record(
    "holders: a market not listed on the network → 404",
    (await codeOf(holdersOf(h, undefined, UNLISTED_MARKET_ID))) === "NOT_FOUND",
  );

  const crowd = await Promise.all(Array.from({ length: MARKET_HOLDERS_MAX + fix.beyondCap }, () => member(h)));
  crowd.forEach((u, i) => {
    holding(h, { user: u, market: CROWD.ref, side: "LONG", size: BigInt(i + 1) * fix.wad, entry: fix.mark18 });
  });
  const many = await holdersOf(h, undefined, CROWD.engineId);
  const sizes = many.holders.map((x) => x.size18);
  checks.record(
    "holders: at most MARKET_HOLDERS_MAX, largest first, the rest counted in `more`",
    many.holders.length === MARKET_HOLDERS_MAX &&
      many.more === fix.beyondCap &&
      many.holders[0]?.address === crowd.at(-1)?.lower &&
      sizes.every((s, i) => i === 0 || (sizes[i - 1] ?? 0n) > s) &&
      many.holders.every((x) => x.upnlUsd6 === 0n),
    { count: many.holders.length, more: many.more },
  );
}
