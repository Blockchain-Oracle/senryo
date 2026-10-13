/**
 * An open position as a live object (R5.26, Codex direction 15, D-343), one copy for both apps: its head ("BTC ↑ ·
 * 10×", "BTC ↑ · 5m", "BTC · Range · 5m"), its clock — the time left ticking on the server's clock, or why it isn't —
 * the fraction of its life left for the ring around its mark, and its own PnL path from what this device recorded.
 * Never the entry, margin, fees, knock-out or cap: those live on the terminal's chart and in Position details.
 */
import { RIDE_TERMS, TESTNET_CHAIN_ID } from "@senryo/config";
import { clockText, laneLabel } from "@senryo/core";
import type { BookEntry } from "./book.ts";
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
