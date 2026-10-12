/**
 * Where a placed leg stands (P3's settlement track, both apps): settled legs read their verdict; a pending leg compares
 * the live price with its window's open print — "Ahead" or "Behind" — and counts down to its close; before the open
 * print is known it only counts down. Words and a tone; the platform draws them.
 */
import { clockText } from "@senryo/core";
import { useLive, useServerSeconds } from "@senryo/live/react";
import { LEG_WORD } from "./parlay.ts";

export type LegTone = "up" | "down" | "muted";

export function useLegStanding(leg: {
  symbol: string;
  cadenceSec: number;
  start: number;
  band: number;
  outcome: keyof typeof LEG_WORD;
}): { text: string; tone: LegTone } {
  const now = useServerSeconds();
  const live = useLive();
  if (leg.outcome !== "pending") {
    return {
      text: LEG_WORD[leg.outcome],
      tone: leg.outcome === "won" ? "up" : leg.outcome === "lost" ? "down" : "muted",
    };
  }
  const left = Math.max(0, leg.start + leg.cadenceSec - now);
  const k = live.prints.at(leg.symbol, leg.start)?.priceE8;
  const spot = live.prices.latest(leg.symbol)?.priceE8;
  if (now < leg.start || k === undefined || spot === undefined || spot === Number(k)) {
    return { text: now < leg.start ? "Waiting for its round" : `Closes in ${clockText(left)}`, tone: "muted" };
  }
  const ahead = leg.band === 0 ? spot > Number(k) : spot < Number(k);
  return { text: `${ahead ? "Ahead" : "Behind"} · ${clockText(left)}`, tone: ahead ? "up" : "down" };
}
