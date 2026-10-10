import { basketMembers, type MarketSpec } from "./catalog.ts";

/**
 * Whether a market has a price source at all (D-310, 04-pricing F3/R11). RedStone's keyless public gateways stop
 * answering on 29 Oct 2026. Without the api's own key (`REDSTONE_GATEWAYS`), every RedStone market — and a basket with
 * a RedStone member — is read-only discovery from then: listed, with the reason, no calls. Setting the key brings them
 * back on the api's next start; nothing else changes.
 */
const MS_PER_SECOND = 1_000;
export const REDSTONE_KEYLESS_END_SEC = Date.parse("2026-10-29T00:00:00Z") / MS_PER_SECOND;

/** What the apps show on a paused market's row and panel. */
export const MARKET_PAUSED_TEXT = "Paused · price feed offline";

function onRedStone(m: MarketSpec): boolean {
  return m.source.kind === "redstone" || basketMembers(m).some(({ market }) => market.source.kind === "redstone");
}

/** Why a market can't take calls at all — no price source, unlike a session that opens on its own — or null. */
export function pauseOf(m: MarketSpec, nowSec: number, redstoneKeyed: boolean): string | null {
  if (redstoneKeyed || nowSec < REDSTONE_KEYLESS_END_SEC) return null;
  return onRedStone(m) ? MARKET_PAUSED_TEXT : null;
}

// ------------------------------------------------------------------------------------ feed state (04-pricing R6)

/**
 * Every market's price state, judged by the api from server time, the market's calendar and its newest publish time
 * (never from when a device last heard a tick):
 * - `live` / `delayed` / `stale`: the settlement price's age against its source's own cadence;
 * - `closed`: outside its session (the price is the last print);
 * - `halted`: D-289 — a Pyth price stale past 15 s or wider than 50 bps while open, confirmed twice;
 * - `fallback`: the line is moved by a labelled display source while the settlement source is late (R1.16).
 */
export const FEED_STATES = ["live", "delayed", "stale", "closed", "halted", "fallback"] as const;
export type FeedState = (typeof FEED_STATES)[number];

/** One letter per state: the `h` digest on the stream is one letter per catalogue index. */
export const FEED_STATE_CODE: Readonly<Record<FeedState, string>> = {
  live: "L",
  delayed: "D",
  stale: "S",
  closed: "C",
  halted: "H",
  fallback: "F",
};
const STATE_OF_CODE = new Map(FEED_STATES.map((s) => [FEED_STATE_CODE[s], s] as const));

export function feedStateOfCode(code: string): FeedState | undefined {
  return STATE_OF_CODE.get(code);
}

export interface FeedTiming {
  cadenceMs: number;
  /** Older than this: `delayed`. */
  delayedMs: number;
  /** Older than this: `stale`. */
  staleMs: number;
}

/**
 * Pyth streams at 1 Hz (delayed at 2.5×, stale at 5×). RedStone signs a 10 s grid whose packages appear 4–6.5 s after
 * each point and are read at +7 s: one is ~7.5 s old on arrival and ~17.5 s just before the next (measured 10 Oct), so
 * delayed past 20 s (one read missed) and stale past 30 s.
 */
export const FEED_TIMING: Readonly<Record<"pyth" | "redstone", FeedTiming>> = {
  pyth: { cadenceMs: 1_000, delayedMs: 2_500, staleMs: 5_000 },
  redstone: { cadenceMs: 10_000, delayedMs: 20_000, staleMs: 30_000 },
};

/** A market's timing: its source's; a basket's slowest member's. */
export function feedTimingOf(m: MarketSpec): FeedTiming {
  if (m.source.kind !== "basket") return FEED_TIMING[m.source.kind];
  return onRedStone(m) ? FEED_TIMING.redstone : FEED_TIMING.pyth;
}

/** A quote or a limit is computed only on a live settlement price (04 §6.3). */
export function isQuotable(s: FeedState): boolean {
  return s === "live";
}

/** Watchers (exits, game decks) act on a settlement price that is live or a little late — never on a display one. */
export function isWatchable(s: FeedState): boolean {
  return s === "live" || s === "delayed";
}

/** Worst first: a basket takes its worst member's state. */
const SEVERITY: readonly FeedState[] = ["halted", "stale", "closed", "fallback", "delayed", "live"];

export function worstState(states: readonly FeedState[]): FeedState {
  return SEVERITY.find((s) => states.includes(s)) ?? "stale";
}
