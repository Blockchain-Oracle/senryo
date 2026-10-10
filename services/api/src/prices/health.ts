import { FEED_STATES, type FeedState } from "@senryo/config";
import type { FanoutStats } from "../stream/bus.ts";
import type { GatewayStatus } from "./gateway.ts";

/**
 * `/status` from the price states (04-pricing R6, F7 — it used to say "not wired yet"): a source is ok when every open
 * market on it is live, down when none is even delayed, degraded otherwise; a closed market counts for nothing. A
 * display fallback is not live (it moves the line, never a quote). Prices overall follow the same rule over every
 * market: one source down with others live is degraded, not down (it read "down" with BTC live, 10 Oct).
 */
type Health = "ok" | "degraded" | "down" | "unknown";

export function healthOf(counts: Record<FeedState, number>): Health {
  const open = FEED_STATES.reduce((sum, s) => sum + counts[s], 0) - counts.closed;
  if (open === 0 || counts.live === open) return "ok";
  return counts.live + counts.delayed === 0 ? "down" : "degraded";
}

function words(counts: Record<FeedState, number>): string {
  return FEED_STATES.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}`)
    .join(" · ");
}

export function priceStatus(g: GatewayStatus, stream: FanoutStats) {
  const priceSources = Object.entries(g.states).map(([source, counts]) => ({
    source,
    state: healthOf(counts),
    counts,
  }));
  const total = Object.fromEntries(FEED_STATES.map((s) => [s, 0])) as Record<FeedState, number>;
  for (const { counts } of priceSources) for (const s of FEED_STATES) total[s] += counts[s];
  const state = g.keyed ? healthOf(total) : "down";
  return {
    prices: { state, detail: g.keyed ? words(total) : "no Pyth key" },
    priceSources,
    priceDiagnostics: { stream, hermes: g.hermes, silence: g.silence, rest: g.rest, watch: g.watch },
  };
}
