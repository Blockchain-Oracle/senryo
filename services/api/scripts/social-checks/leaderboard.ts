/**
 * Leaderboard service + routes (S12b.5, S12b.3 recommendations) over the mocked indexer: 503 before a network's first
 * snapshot, ranks per period from the right source (rolling fills / UTC-day buckets / lifetime), listed-only and
 * per-network, the floor and "Your rank" states, the following scope, Top Trades (sharers only), recommendations and
 * an unlisting that applies at once.
 */
import {
  blockRoute,
  followRoute,
  type Leaderboard,
  type LeaderboardPeriod,
  leaderboardRoute,
  profilePutRoute,
  recommendationsRoute,
  STANDINGS_MAX,
  standingsRoute,
  topTradesRoute,
} from "@senryo/api-client";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import { MS_PER_SECOND, SECONDS_PER_DAY } from "@senryo/service-common";
import { LEADERBOARD_FLOOR, WINDOW_DAYS } from "../../src/social/constants.ts";
import { type Checks, codeOf, type Harness, type User } from "../social-harness.ts";
import { LB_DAYS, LB_FILL, LB_TOP, LB_TOTALS } from "./constants.ts";
import { leaderboardMathChecks } from "./leaderboard-math.ts";
import { fill, member, nowSec, position, XAG } from "./seed.ts";

const HTTP_BAD_REQUEST = 400;

type DaySeed = (typeof LB_DAYS)[keyof typeof LB_DAYS];
type TotalSeed = (typeof LB_TOTALS)[keyof typeof LB_TOTALS];

function seedDay(h: Harness, u: User, today: number, d: DaySeed): void {
  const day = today - d.back;
  h.mock.days.push({
    chainId: TESTNET_CHAIN_ID,
    id: `${u.lower}-${day}`,
    user_id: u.lower,
    day,
    realizedPnl: d.pnl,
    fees: d.fees,
    funding: d.funding,
    volume: d.volume,
    trades: d.trades,
  });
}

function seedTotals(h: Harness, u: User, t: TotalSeed, chainId: ChainId = TESTNET_CHAIN_ID): void {
  h.mock.totals.push({
    chainId,
    id: u.lower,
    realizedPnl: t.pnl,
    feesPaid: t.fees,
    fundingPaid: t.funding,
    borrowPaid: t.borrow,
    volume: t.volume,
    tradeCount: t.trades,
    deposited: 0n,
  });
}

/**
 * F-D4 per-address standings: the same numbers as the board row, below-floor numbers kept with a null rank, null
 * numbers without activity, `not_listed` for an unlisted account, request order kept and duplicates folded, and the
 * address cap enforced.
 */
async function standingsChecks(
  h: Harness,
  checks: Checks,
  who: { ranked: User; below: User; idle: User; unlisted: User },
  day: Leaderboard,
): Promise<void> {
  const read = (addresses: `0x${string}`[]) =>
    h.anon.call(standingsRoute, { query: { chainId: TESTNET_CHAIN_ID, period: "24h", addresses } });
  const { ranked, below, idle, unlisted } = who;
  const got = await read([
    ranked.address,
    below.address,
    idle.address,
    unlisted.address,
    ranked.lower as `0x${string}`,
  ]);
  const [r, b, i, u] = got.items;
  const row = day.entries.find((e) => e.address === ranked.address);
  checks.record(
    "standings: one item per distinct address, request order kept",
    got.items.map((s) => s.address).join() === [ranked, below, idle, unlisted].map((x) => x.address).join(),
    got.items,
  );
  checks.record(
    "standings: a ranked account matches its board row (net, rank, trades)",
    r?.status === "ranked" &&
      r.netPnlUsd6 === row?.netPnlUsd6 &&
      r.rank === row.globalRank &&
      r.trades === row.trades &&
      got.floor.minTrades === day.floor.minTrades,
    { r, row },
  );
  checks.record(
    "standings: below the floor → rank null, numbers kept",
    b?.status === "below_floor" && b.rank === null && b.trades === LB_FILL.carol.count && b.netPnlUsd6 !== null,
    b,
  );
  checks.record(
    "standings: no activity → null numbers; unlisted → not_listed",
    i?.status === "no_activity" && i.netPnlUsd6 === null && u?.status === "not_listed" && u.netPnlUsd6 === null,
    { i, u },
  );
  // The client refuses to encode an over-long list, so the server's own cap is asked directly.
  const many = Array.from({ length: STANDINGS_MAX + 1 }, () => h.user().address).join(",");
  const capped = await h.app.inject({
    method: "GET",
    url: `${standingsRoute.path}?chainId=${TESTNET_CHAIN_ID}&period=24h&addresses=${many}`,
  });
  checks.record(
    "standings: more than STANDINGS_MAX addresses → 400",
    capped.statusCode === HTTP_BAD_REQUEST,
    capped.statusCode,
  );
}

export async function leaderboardChecks(h: Harness, checks: Checks): Promise<void> {
  leaderboardMathChecks(checks);

  const now = nowSec();
  const today = Math.floor(now / SECONDS_PER_DAY);
  const [alice, bob, erin] = [await member(h), await member(h), await member(h)];
  const carol = await member(h, { publicTradesPractice: false });
  const dave = await member(h, { listedPractice: false });
  const frank = await member(h, { listedMainnet: true });
  for (let i = 0; i < LB_FILL.count; i += 1) {
    fill(h, { user: alice, notional: LB_FILL.notional, pnl: LB_FILL.alice.pnl, fee: LB_FILL.alice.fee, at: now - i });
    fill(h, { user: bob, notional: LB_FILL.notional, pnl: LB_FILL.bob.pnl, at: now - i });
    fill(h, { user: dave, notional: LB_FILL.notional, pnl: LB_FILL.dave.pnl, at: now - i });
  }
  for (let i = 0; i < LB_FILL.carol.count; i += 1) {
    fill(h, { user: carol, notional: LB_FILL.notional, pnl: LB_FILL.carol.pnl, at: now - i });
  }
  seedDay(h, alice, today, LB_DAYS.aliceToday);
  seedDay(h, alice, today, LB_DAYS.aliceEarlier);
  seedDay(h, bob, today, LB_DAYS.bobWeekAgo);
  seedTotals(h, alice, LB_TOTALS.alice);
  seedTotals(h, bob, LB_TOTALS.bob);
  seedTotals(h, alice, LB_TOTALS.aliceMainnet, MAINNET_CHAIN_ID);
  seedTotals(h, frank, LB_TOTALS.frankMainnet, MAINNET_CHAIN_ID);
  position(h, { user: alice, pnl: 0n, notional: LB_FILL.notional, market: XAG });
  const aliceTop = position(h, {
    user: alice,
    pnl: LB_TOP.alice.pnl,
    notional: LB_TOP.alice.notional,
    closedAt: now + 1,
  });
  const carolTop = position(h, {
    user: carol,
    pnl: LB_TOP.carol.pnl,
    notional: LB_TOP.carol.notional,
    closedAt: now + 1,
  });

  const board = (u: User | undefined, period: LeaderboardPeriod, chainId: ChainId = TESTNET_CHAIN_ID) =>
    (u?.api ?? h.anon).call(leaderboardRoute, { query: { chainId, period, scope: "all" } });
  const order = async (period: LeaderboardPeriod) => (await board(undefined, period)).entries.map((e) => e.address);

  const before = await codeOf(board(undefined, "24h", MAINNET_CHAIN_ID));
  checks.record("leaderboard: 503 until the network's first snapshot", before === "UPSTREAM_UNAVAILABLE", before);
  await h.social.leaderboard.refresh(TESTNET_CHAIN_ID);
  await h.social.leaderboard.refresh(MAINNET_CHAIN_ID);

  const day = await board(undefined, "24h");
  checks.record(
    "24h: rolling fills rank bob (net 60) over alice (net 27); unlisted dave and below-floor carol absent",
    day.entries.map((e) => e.address).join() === [bob.address, alice.address].join() &&
      day.entries[0]?.netPnlUsd6 === BigInt(LB_FILL.count) * LB_FILL.bob.pnl,
    day.entries,
  );
  const aliceRow = day.entries.find((e) => e.address === alice.address);
  checks.record(
    "24h: net = pnl − fees, notional summed, asset cluster from positions",
    aliceRow?.netPnlUsd6 === BigInt(LB_FILL.count) * (LB_FILL.alice.pnl - LB_FILL.alice.fee) &&
      aliceRow.notionalUsd6 === BigInt(LB_FILL.count) * LB_FILL.notional &&
      aliceRow.markets.includes(XAG.symbol),
    aliceRow,
  );
  checks.record(
    "response: metric, floor and window are published",
    day.metric === "realized_pnl_after_fees_funding_borrow" &&
      day.floor.minTrades === LEADERBOARD_FLOOR["24h"].minTrades &&
      day.window.kind === "rolling",
  );
  const carolSees = (await board(carol, "24h")).you;
  checks.record(
    "you: below the floor → Not ranked (null), numbers shown",
    carolSees?.status === "below_floor" && carolSees.rank === null && carolSees.trades === LB_FILL.carol.count,
    carolSees,
  );
  const erinSees = (await board(erin, "24h")).you;
  checks.record(
    "you: no indexed activity → null numbers, never 0",
    erinSees?.status === "no_activity" && erinSees.rank === null && erinSees.netPnlUsd6 === null,
    erinSees,
  );
  checks.record("you: unlisted → not_listed", (await board(dave, "24h")).you?.status === "not_listed");
  const bobSees = (await board(bob, "24h")).you;
  checks.record("you: ranked → rank 1", bobSees?.status === "ranked" && bobSees.rank === 1, bobSees);

  await standingsChecks(h, checks, { ranked: alice, below: carol, idle: erin, unlisted: dave }, day);

  const week = await board(undefined, "7d");
  const weekNet = LB_DAYS.aliceToday.pnl - LB_DAYS.aliceToday.fees - LB_DAYS.aliceToday.funding;
  const sinceDay = today - (WINDOW_DAYS["7d"] - 1);
  checks.record(
    "7d: UTC-day buckets — today counts, 7 days ago doesn't (bob out)",
    week.entries.map((e) => e.address).join() === alice.address &&
      week.entries[0]?.netPnlUsd6 === weekNet &&
      week.window.from === new Date(sinceDay * SECONDS_PER_DAY * MS_PER_SECOND).toISOString(),
    week,
  );
  checks.record(
    "30d: bob (7 days ago) and alice (today + 20 days ago) both rank",
    (await order("30d")).join() === [bob.address, alice.address].join(),
  );
  checks.record(
    "all: lifetime totals after fees, funding and borrow",
    (await order("all")).join() === [alice.address, bob.address].join(),
  );
  const main = await board(undefined, "all", MAINNET_CHAIN_ID);
  checks.record(
    "mainnet: ranked separately; alice (unlisted there) never appears despite the best totals",
    main.entries.map((e) => e.address).join() === frank.address,
    main.entries,
  );
  checks.record(
    "ranks: never 0",
    [day, week, main].every((b) => b.entries.every((e) => e.rank >= 1)),
  );

  await erin.api.call(followRoute, { params: { address: bob.address } });
  const erinScope = await erin.api.call(leaderboardRoute, {
    query: { chainId: TESTNET_CHAIN_ID, period: "24h", scope: "following" },
  });
  checks.record(
    "following: ranks among followees (+ you)",
    erinScope.entries.length === 1 && erinScope.entries[0]?.address === bob.address && erinScope.entries[0].rank === 1,
    erinScope.entries,
  );
  const aliceScope = await alice.api.call(leaderboardRoute, {
    query: { chainId: TESTNET_CHAIN_ID, period: "24h", scope: "following" },
  });
  checks.record(
    "following: you rank 1 among yourself, global rank kept",
    aliceScope.you?.rank === 1 && aliceScope.you.globalRank === 2,
    aliceScope.you,
  );
  const anonScope = await codeOf(
    h.anon.call(leaderboardRoute, { query: { chainId: TESTNET_CHAIN_ID, period: "24h", scope: "following" } }),
  );
  checks.record("following: needs a session", anonScope === "UNAUTHORIZED", anonScope);

  const top = await h.anon.call(topTradesRoute, { query: { chainId: TESTNET_CHAIN_ID } });
  checks.record(
    "top trades: sharers only (carol's better close stays out)",
    top.items.some((i) => i.positionId === aliceTop.id) && !top.items.some((i) => i.positionId === carolTop.id),
    top.items,
  );

  const recs = async (u: User) =>
    (await u.api.call(recommendationsRoute, { query: { chainId: TESTNET_CHAIN_ID } })).items.map((i) => i.address);
  checks.record("recommendations: 30d ranked floor minus who you follow", (await recs(erin)).join() === alice.address);
  checks.record("recommendations: never yourself", !(await recs(bob)).includes(bob.address));
  await alice.api.call(blockRoute, { params: { address: erin.address } });
  checks.record("recommendations: blocks either way excluded", (await recs(erin)).length === 0);

  await bob.api.call(profilePutRoute, { body: { listedPractice: false } });
  checks.record(
    "unlisting applies at once (no wait for the next snapshot)",
    (await order("24h")).join() === alice.address,
  );
}
