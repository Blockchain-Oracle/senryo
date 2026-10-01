/**
 * What the leaderboard says about itself (direction §9: "Publish the definition"). Every sentence is built from what
 * the api returns with the board — `metric`, `window`, `floor` — so the screen can't describe a ranking the server
 * doesn't compute. Money is the active mode's (`usd` prints P$ in practice).
 */
import type { Leaderboard, LeaderboardPeriod } from "@senryo/api-client";
import { usd } from "~/lib/money";
import { utcDay } from "./format";

export const PERIOD_OPTIONS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
] as const satisfies readonly { value: LeaderboardPeriod; label: string }[];

/** The period every board opens on (the api's own default). */
export const DEFAULT_PERIOD: LeaderboardPeriod = "7d";

export function isPeriod(value: string | undefined): value is LeaderboardPeriod {
  return PERIOD_OPTIONS.some((option) => option.value === value);
}

export const PERIOD_WORDS: Record<LeaderboardPeriod, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  all: "all time",
};

/** The period as an adjective: "the 7-day board". */
export const PERIOD_BOARD: Record<LeaderboardPeriod, string> = {
  "24h": "24-hour",
  "7d": "7-day",
  "30d": "30-day",
  all: "all-time",
};

/** One line per metric the api can name; a new metric must add its sentence here before it can ship. */
export const METRIC_COPY: Record<Leaderboard["metric"], { line: string; detail: string }> = {
  realized_pnl_after_fees_funding_borrow: {
    line: "Realized P&L after fees, funding and borrow",
    detail:
      "Traders are ranked by realized profit and loss: what closed trades made or lost, after trading fees, funding and borrow. Open positions don’t count until they close.",
  },
};

/** No decimals: a floor is a round threshold, not a balance. */
const FLOOR_DECIMALS = 0;

export function floorCopy(floor: Leaderboard["floor"]): string {
  const trades = `${floor.minTrades} ${floor.minTrades === 1 ? "trade" : "trades"}`;
  return `${trades} and ${usd(floor.minNotionalUsd6, FLOOR_DECIMALS)} traded`;
}

export function windowCopy(window: Leaderboard["window"]): string {
  switch (window.kind) {
    case "rolling":
      return "The last 24 hours, counted continuously.";
    case "utc_days":
      return window.from
        ? `Whole days in UTC from ${utcDay(window.from)}, today included.`
        : "Whole days in UTC, today included.";
    case "lifetime":
      return "Everything since the account’s first trade.";
  }
}
