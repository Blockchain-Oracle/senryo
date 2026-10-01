/**
 * Leaderboard window math (S12b.5), pure: rolling 24h edges, UTC-day bucket edges, the net PnL identity on fills,
 * day buckets and lifetime totals, the anti-farming floor ("Not ranked", never 0), tie-breaks, the Monday week start
 * and the weekly Top Trades picks.
 */
import { TOP_TRADES_MAX } from "@senryo/api-client";
import { MS_PER_SECOND, SECONDS_PER_DAY } from "@senryo/service-common";
import { ROLLING_WINDOW_SEC, TOP_TRADE_MIN_NOTIONAL_USD6 } from "../../src/social/constants.ts";
import {
  dayOf,
  NO_ACTIVITY,
  netOfDay,
  netOfFill,
  netOfLifetime,
  pickTopTrades,
  rankTotals,
  sumDays,
  sumFills,
  type Totals,
  weekStartSec,
  windowOf,
} from "../../src/social/leaderboard-math.ts";
import type { Checks } from "../social-harness.ts";

/** Thursday 1 Oct 2026 12:00 UTC; its week starts Monday 28 Sep 00:00 UTC. */
const at = (iso: string): number => Date.parse(iso) / MS_PER_SECOND;
const NOW = at("2026-10-01T12:00:00Z");
const MONDAY = at("2026-09-28T00:00:00Z");
const SUNDAY_LATE = at("2026-10-04T23:59:59Z");
const NEXT_MONDAY = at("2026-10-05T00:00:00Z");
const SEVEN = 7;
const THIRTY = 30;

const fillRow = (user_id: string, timestamp: number, pnl = 100n) => ({
  user_id,
  realizedPnl: pnl,
  fee: 3n,
  funding: 2n,
  borrow: 1n,
  notional: 1_000n,
  timestamp,
});
const dayRow = (user_id: string, day: number) => ({
  user_id,
  day,
  realizedPnl: 100n,
  fees: 3n,
  funding: 3n,
  volume: 1_000n,
  trades: 1,
});
/** Floor fixture: a at the floor, b too few trades, c too little notional, d a ranked loss, e ties a on more notional. */
const FLOOR = { minTrades: 3, minNotionalUsd6: 100n };
const B_NET = 500n;
const RANK_FIXTURE: Record<string, Totals> = {
  a: { netPnl: 50n, notional: 100n, trades: 3 },
  b: { netPnl: B_NET, notional: 1_000n, trades: 2 },
  c: { netPnl: 900n, notional: 99n, trades: 5 },
  d: { netPnl: -10n, notional: 200n, trades: 4 },
  e: { netPnl: 50n, notional: 300n, trades: 3 },
  idle: { netPnl: 0n, notional: 0n, trades: 0 },
};

export function leaderboardMathChecks(checks: Checks): void {
  const day = windowOf("24h", NOW);
  checks.record(
    "window: 24h is rolling now − 24h → now",
    day.kind === "rolling" && day.fromSec === NOW - ROLLING_WINDOW_SEC,
  );
  const week = windowOf("7d", NOW);
  const month = windowOf("30d", NOW);
  checks.record(
    "window: 7d / 30d are UTC days, today included",
    week.kind === "utc_days" &&
      week.sinceDay === dayOf(NOW) - (SEVEN - 1) &&
      week.fromSec === (dayOf(NOW) - (SEVEN - 1)) * SECONDS_PER_DAY &&
      month.sinceDay === dayOf(NOW) - (THIRTY - 1),
    { week, month },
  );
  checks.record("window: all is lifetime", windowOf("all", NOW).fromSec === null);
  checks.record(
    "week: starts Monday 00:00 UTC",
    weekStartSec(NOW) === MONDAY &&
      weekStartSec(MONDAY) === MONDAY &&
      weekStartSec(SUNDAY_LATE) === MONDAY &&
      weekStartSec(NEXT_MONDAY) === NEXT_MONDAY,
  );

  const edge = sumFills(
    [fillRow("a", NOW - ROLLING_WINDOW_SEC), fillRow("b", NOW - ROLLING_WINDOW_SEC - 1)],
    NOW - ROLLING_WINDOW_SEC,
    NOW,
  );
  checks.record("24h: a fill exactly 24h old counts, one second older doesn't", edge.has("a") && !edge.has("b"));
  const net = 94n;
  checks.record(
    "metric: fill, day bucket and lifetime agree (pnl − fees − funding − borrow)",
    netOfFill(fillRow("a", NOW)) === net &&
      netOfDay(dayRow("a", 0)) === net &&
      netOfLifetime({
        id: "a",
        realizedPnl: 100n,
        feesPaid: 3n,
        fundingPaid: 2n,
        borrowPaid: 1n,
        volume: 0n,
        tradeCount: 1,
      }) === net,
  );
  const since = week.sinceDay ?? 0;
  const days = sumDays([dayRow("in", since), dayRow("out", since - 1), dayRow("in", since + 1)], since);
  checks.record(
    "7d: the first day counts, the day before doesn't; buckets add up",
    days.get("in")?.netPnl === 2n * net && days.get("in")?.trades === 2 && !days.has("out"),
    Object.fromEntries(days),
  );

  const totals = new Map(Object.entries(RANK_FIXTURE));
  const { ranked, standings } = rankTotals(totals, FLOOR);
  checks.record(
    "floor: exactly at the floor ranks; ties go to more notional; losses rank too",
    ranked.map((r) => `${r.address}${r.rank}`).join(",") === "e1,a2,d3",
    ranked,
  );
  const b = standings.get("b");
  const c = standings.get("c");
  checks.record(
    "floor: too few trades or too little notional → Not ranked (null, never 0), numbers kept",
    b?.status === "below_floor" && b.rank === null && b.totals.netPnl === B_NET && c?.status === "below_floor",
    { b, c },
  );
  checks.record(
    "floor: no activity → no standing at all (null numbers)",
    !standings.has("idle") && (standings.get("idle") ?? NO_ACTIVITY).totals === null,
  );

  const big = TOP_TRADE_MIN_NOTIONAL_USD6;
  const pos = (p: { id: string; user: string; pnl: bigint; notional?: bigint; closedAt?: number }) => ({
    id: p.id,
    user_id: p.user,
    realizedPnl: p.pnl,
    feesPaid: 0n,
    fundingPaid: 0n,
    borrowPaid: 0n,
    closedAt: p.closedAt ?? NOW,
    fills: [
      { kind: "OPEN", notional: p.notional ?? big, txHash: `0x${p.id}open` },
      { kind: "CLOSE", notional: p.notional ?? big, txHash: `0x${p.id}close` },
    ],
  });
  const sharing = new Map([
    ["u1", MONDAY],
    ["u2", MONDAY],
    ["u3", MONDAY],
    ["u4", NOW],
    ["u5", MONDAY - SECONDS_PER_DAY * SEVEN],
  ]);
  const picks = pickTopTrades(
    [
      pos({ id: "p1", user: "u1", pnl: 100n }),
      pos({ id: "p2", user: "u1", pnl: 300n }),
      pos({ id: "p3", user: "u2", pnl: -5n }),
      pos({ id: "p4", user: "u3", pnl: 1_000n, notional: big - 1n }),
      pos({ id: "p5", user: "u4", pnl: 50n, closedAt: NOW - 1 }),
      pos({ id: "p6", user: "u5", pnl: 70n, closedAt: MONDAY - 1 }),
      pos({ id: "p7", user: "stranger", pnl: 9_000n }),
    ],
    sharing,
    MONDAY,
    big,
    TOP_TRADES_MAX,
  );
  checks.record(
    "top trades: best per sharer, positive, ≥ min notional, after sharing start and week start",
    picks.map((p) => p.position.id).join(",") === "p2" && picks[0]?.closeTxHash === "0xp2close",
    picks.map((p) => p.position.id),
  );
}
