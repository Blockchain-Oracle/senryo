import { CADENCES_SEC, type CadenceSec, LOCKOUT_SEC } from "@senryo/config";
import { clockText, laneLabel, windowCountdown } from "@senryo/core";
import { useServerSeconds } from "@senryo/live/react";
import { useCatalog } from "@senryo/query";
import { useMemo } from "react";
import { type MarketLine, marketLine, marketOf, marketSession } from "./markets.ts";

const SECONDS_PER_MINUTE = 60;

/**
 * A market's row line on the server's clock: the session is worked out once a minute (it changes on 15-minute
 * boundaries), the window countdown every second; a market the api says is paused (D-310) reads its reason, one it
 * says isn't on chain yet (R1.24) "Not open for calls yet".
 */
export function useMarketLine(symbol: string): MarketLine {
  const now = useServerSeconds();
  const minute = Math.floor(now / SECONDS_PER_MINUTE);
  const session = useMemo(() => marketSession(symbol, now), [symbol, minute]);
  const catalog = useCatalog();
  const entry = "value" in catalog ? catalog.value.markets.find((m) => m.symbol === symbol) : undefined;
  return marketLine(session, now, entry?.paused ?? null, entry?.listed ?? true);
}

/** One lane's moment: "5m 3:42" while calls are open, "5m opens 0:12" in its lockout. */
export interface LaneCell {
  cadence: CadenceSec;
  label: string;
  open: boolean;
  /** The time to calls closing (open) or to the next window (in the lockout). */
  clock: string;
}

export function laneCells(nowSec: number, cadences: readonly CadenceSec[] = CADENCES_SEC): LaneCell[] {
  return cadences.map((cadence) => {
    const w = windowCountdown(nowSec, cadence, LOCKOUT_SEC);
    return { cadence, label: laneLabel(cadence), open: w.open, clock: clockText(w.open ? w.closesIn : w.endsIn) };
  });
}

/**
 * Every lane of a market at once (R6.4, Codex direction 13): the four countdowns while it trades; null while it
 * doesn't (closed, paused, not yet on chain), when its line's words say why instead.
 */
export function useMarketLanes(symbol: string): { line: MarketLine; lanes: LaneCell[] | null } {
  const line = useMarketLine(symbol);
  const now = useServerSeconds();
  const cadences = marketOf(symbol)?.cadences ?? CADENCES_SEC;
  return { line, lanes: line.trading ? laneCells(now, cadences) : null };
}

/** The one round clock a list of markets shows (D-348): the first lane's window — closing, or reopening after it. */
export interface RoundClock {
  label: string;
  open: boolean;
  /** "closes in 0:42" or "reopens in 0:19". */
  text: string;
  /** The window's start and calls' close (unix seconds), for a CountdownRing. */
  fromSec: number;
  toSec: number;
  nowSec: number;
}

export function useRoundClock(): RoundClock {
  const now = useServerSeconds();
  const cadence = CADENCES_SEC[0];
  const w = windowCountdown(now, cadence, LOCKOUT_SEC);
  const start = now - (cadence - w.endsIn);
  return {
    label: laneLabel(cadence),
    open: w.open,
    text: w.open ? `closes in ${clockText(w.closesIn)}` : `reopens in ${clockText(w.endsIn)}`,
    fromSec: start,
    toSec: start + cadence - LOCKOUT_SEC,
    nowSec: now,
  };
}
