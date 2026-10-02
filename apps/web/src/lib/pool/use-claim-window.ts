"use client";

/**
 * When the next claim window opens (flow book D2 "Next window"): a claim needs every listed market OPEN
 * (`LpVault.sol:98`), so the window opens at the latest next-open among the markets that are shut now, plus the
 * 300 s REOPENING spell. Metals and FX each keep one calendar, so two calendar reads cover every market. Undefined
 * when every market is open (claim now) or when a calendar or market can't be read ("Waiting for prices").
 */
import { nextTransition, RISK } from "@senryo/core";
import { useCalendar, useMarkets } from "@senryo/query";

const MS_PER_SECOND = 1000n;

export function useClaimWindow(): { allOpen: boolean; opensAt: bigint | undefined } {
  const markets = useMarkets();
  const live = markets.flatMap((m) =>
    m.reading.status === "fresh" || m.reading.status === "stale" ? [m.reading.value] : [],
  );
  const calendarIds = [...new Set(live.map((m) => m.calendarId))].sort((a, b) => a - b);
  const first = useCalendar(calendarIds[0]);
  const second = useCalendar(calendarIds[1]);
  const weeks = new Map(
    [first, second].flatMap((c, i) => {
      const id = calendarIds[i];
      return id !== undefined && (c.status === "fresh" || c.status === "stale") ? [[id, c.value] as const] : [];
    }),
  );
  const shut = live.filter((m) => m.pv.status !== "OPEN");
  if (live.length === markets.length && shut.length === 0) return { allOpen: true, opensAt: undefined };
  const now = BigInt(Date.now()) / MS_PER_SECOND;
  let latest: bigint | undefined;
  for (const m of shut) {
    const week = weeks.get(m.calendarId);
    const opens = week ? nextTransition(week, now, true) : undefined;
    if (opens === undefined) return { allOpen: false, opensAt: undefined };
    latest = latest === undefined || opens > latest ? opens : latest;
  }
  return { allOpen: false, opensAt: latest === undefined ? undefined : latest + RISK.REOPEN_WINDOW };
}
