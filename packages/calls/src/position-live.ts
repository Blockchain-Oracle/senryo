/**
 * An open position as a live object (R5.26, Codex direction 15, D-343), one copy for both apps: its head ("BTC ↑ ·
 * 10×", "BTC ↑ · 5m", "BTC · Range · 5m"), its clock — the time left ticking on the server's clock, or why it isn't —
 * the fraction of its life left for the ring around its mark, and its own PnL path from what this device recorded.
 * Never the entry, margin, fees, knock-out or cap: those live on the terminal's chart and in Position details.
 */
import { RIDE_TERMS, TESTNET_CHAIN_ID } from "@senryo/config";
import { clockText, laneLabel } from "@senryo/core";
import type { TerminalIntent } from "@senryo/search";
import type { BookEntry } from "./book.ts";
import { fineDollars } from "./quote.ts";
import type { ReplaySample } from "./replay.ts";

const RIDE_LIFE_SEC = RIDE_TERMS[TESTNET_CHAIN_ID].maxLifeSec;
const RIDE_LEVERAGE_ONE = 10_000;
const HOUR = 3600;
const MINUTE = 60;
const PAD = 2;
/** The ring thickens for the last ten seconds. */
export const LAST_SECONDS = 10;
/** A hole longer than this in the recording breaks the line (the app was closed or the stream down). */
const GAP_MS = 3_000;
const MIN_SAMPLES = 2;
const BPS_PER_PERCENT = 100;
const ROI_DECIMALS = 1;

/** "+$0.0400", "−$12.30": a live PnL (four decimals under $10 so a $1 trade visibly ticks). */
export const pnlText = (v: bigint): string => `${v < 0n ? "−" : "+"}${fineDollars(v)}`;

/** "+0.7%", "0.0%": a return, one decimal. */
export function roiText(bps: number): string {
  const shown = Math.abs(bps / BPS_PER_PERCENT).toFixed(ROI_DECIMALS);
  // A return that rounds to nothing has no sign: "+0.0%" beside a red −$0.0001 reads as a contradiction.
  if (Number(shown) === 0) return `${shown}%`;
  return `${bps < 0 ? "−" : "+"}${shown}%`;
}

/** The life the ring drains over: a call's window, a ride's four hours (null without an end). */
export function positionSpan(e: BookEntry): { fromSec: number; toSec: number } | null {
  const duration = e.ride ? RIDE_LIFE_SEC : e.call ? e.call.cadenceSec : null;
  return e.endsAt === null || duration === null ? null : { fromSec: e.endsAt - duration, toSec: e.endsAt };
}

/** "BTC ↑ · 10×", "BTC ↓ · 5m", "BTC · Range · 5m". */
export function positionHead(e: BookEntry): string {
  const tag = e.ride
    ? `${Math.round(e.ride.leverageBps / RIDE_LEVERAGE_ONE)}×`
    : e.call
      ? laneLabel(e.call.cadenceSec)
      : "";
  const side = e.up === null || (e.label !== "Up" && e.label !== "Down") ? ` · ${e.label}` : ` ${e.up ? "↑" : "↓"}`;
  return `${e.symbol}${side}${tag ? ` · ${tag}` : ""}`;
}

/** Where a tap on the row goes (D-340): the terminal on this exact position — its market, instrument and lane. */
export function positionIntent(e: BookEntry): TerminalIntent {
  return { symbol: e.symbol, instrument: e.kind, position: e.key, ...(e.call ? { lane: e.call.cadenceSec } : {}) };
}

/**
 * Close all, as a review before it runs (D-343): how many can close now, what they return together at today's quotes,
 * and how many can't — "Close all (3)" when every one can, "Close available (2)" when some can't; null under two.
 */
export interface CloseReview {
  entries: readonly BookEntry[];
  /** "Close all (3)" / "Close available (2)". */
  action: string;
  estimate: bigint;
  unavailable: number;
}

export function closeReview(all: readonly BookEntry[]): CloseReview | null {
  const entries = all.filter((e) => e.closeValue !== null);
  if (entries.length < MIN_SAMPLES) return null;
  const unavailable = all.length - entries.length;
  return {
    entries,
    action: unavailable === 0 ? `Close all (${entries.length})` : `Close available (${entries.length})`,
    estimate: entries.reduce((sum, e) => sum + (e.closeValue ?? 0n), 0n),
    unavailable,
  };
}

/** "3:42:18": hours always (a ride's clock). */
export function hmsText(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / HOUR);
  const m = String(Math.floor((s % HOUR) / MINUTE)).padStart(PAD, "0");
  return `${h}:${m}:${String(s % MINUTE).padStart(PAD, "0")}`;
}

export interface PositionClock {
  /** What the row says under its head. */
  text: string;
  /** Life left, 0–1, for the ring (null: no ring to draw). */
  life: number | null;
  /** In its last ten seconds (the ring thickens). */
  last: boolean;
  /** Live and closable: the row's Close shows. */
  live: boolean;
}

export function positionClock(e: BookEntry, nowSec: number): PositionClock {
  const left = e.endsAt === null || nowSec <= 0 ? null : Math.max(0, Math.ceil(e.endsAt - nowSec));
  const duration = e.ride ? RIDE_LIFE_SEC : e.call ? e.call.cadenceSec : null;
  const life = left === null || duration === null ? null : Math.min(1, Math.max(0, left / duration));
  const last = left !== null && left <= LAST_SECONDS;
  const clock = left === null ? null : e.ride ? hmsText(left) : left >= HOUR ? hmsText(left) : clockText(left);
  const base = { life, last, live: false };
  switch (e.state) {
    case "opening":
      return { ...base, text: "Waiting for fill…" };
    case "closing":
      return { ...base, text: e.kind === "ride" ? "Closing…" : "Cashing out…" };
    case "locked":
      return { ...base, text: clock ? `Cash out closed · settles in ${clock}` : "Cash out closed" };
    case "too-sure":
      return { ...base, text: clock ? `Cash out unavailable · settles in ${clock}` : "Cash out unavailable" };
    case "settling":
      return { life: 0, last: false, live: false, text: "Settling…" };
    case "no-price":
      return { ...base, text: "No live price" };
    case "live":
      if (left === 0) return { life: 0, last: false, live: false, text: "Settling…" };
      return { ...base, live: e.closeValue !== null, text: clock ? `${clock} left` : "Time unavailable" };
  }
}

/**
 * Whether a row offers Close (both apps, one rule): the position is live and its time isn't up. It follows the
 * position's state, not each tick's quote, so a quote that flickers away never pulls the action from under a finger;
 * the action itself stays disabled while there's no close value.
 */
export function closeOffered(e: BookEntry, nowSec: number): boolean {
  return e.state === "live" && (e.endsAt === null || nowSec <= 0 || e.endsAt > nowSec);
}

export interface TraceGeometry {
  /** SVG path data, broken at holes in the recording. */
  d: string;
  /** Where zero PnL sits (the faint baseline). */
  zeroY: number;
  /** The latest point (the stationary endpoint). */
  end: { x: number; y: number };
  tone: "up" | "down" | "flat";
}

/**
 * The position's recorded PnL as a small line (x: recorded time, y: PnL with zero inside the frame): about one point
 * per horizontal pixel, the first and latest always kept, broken across holes. Null with too little recorded.
 */
export function traceGeometry(
  samples: readonly ReplaySample[] | null,
  w: number,
  h: number,
  pad = PAD,
): TraceGeometry | null {
  const pts = (samples ?? []).filter((s): s is [number, number, string] => s[2] !== null);
  const first = pts[0];
  const latest = pts.at(-1);
  if (!first || !latest || pts.length < MIN_SAMPLES || latest[0] <= first[0]) return null;
  const step = Math.max(1, Math.floor(pts.length / w));
  const kept = pts.filter((_, i) => i % step === 0);
  if (kept.at(-1) !== latest) kept.push(latest);
  const values = kept.map((s) => Number(BigInt(s[2])));
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const t0 = first[0];
  const tSpan = latest[0] - t0;
  const x = (t: number) => pad + ((t - t0) / tSpan) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (h - pad * 2);
  let d = "";
  let prev: number | null = null;
  kept.forEach((s, i) => {
    const gap = prev !== null && s[0] - prev > GAP_MS;
    d += `${i === 0 || gap ? "M" : "L"}${x(s[0]).toFixed(1)} ${y(values[i] ?? 0).toFixed(1)} `;
    prev = s[0];
  });
  const lastValue = values.at(-1) ?? 0;
  return {
    d: d.trim(),
    zeroY: y(0),
    end: { x: x(latest[0]), y: y(lastValue) },
    tone: lastValue > 0 ? "up" : lastValue < 0 ? "down" : "flat",
  };
}
