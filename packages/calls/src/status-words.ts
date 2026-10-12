/**
 * The Status board in words, both apps (P6, D-324; Owarine's pulse strip, Canton's status spec): one verdict for the
 * whole service — Live, Delayed, Unavailable or Unverified — with a tally; each component's name, state and numbers;
 * problems first; and the bars — one per hour (24 h) or day (90 d), their height the worst state seen, grey where
 * nothing was recorded (never a pass). Every figure is the api's own; nothing here is inferred.
 */
import type { StatusHistory, StatusResponse } from "@senryo/api-client";

type Component = StatusResponse["components"][number];
export type HealthState = Component["state"];
type Bucket = StatusHistory["components"][number]["buckets"][number];

export const COMPONENT_NAMES: Readonly<Record<Component["id"], { title: string; what: string }>> = {
  prices: { title: "Prices", what: "Every market's live price" },
  settlement: { title: "Settlement", what: "Closed windows paid out" },
  relay: { title: "Relay", what: "Your signed calls sent on chain" },
  keeper: { title: "Keeper", what: "Settles, fills and rolls on time" },
  chain: { title: "Chain", what: "Monad and its RPC" },
  indexer: { title: "Indexer", what: "History and your receipts" },
  deposits: { title: "Deposits", what: "Real dollars in and out" },
};

export const STATE_WORDS: Readonly<Record<HealthState, string>> = {
  ok: "Working",
  degraded: "Delayed",
  down: "Down",
  unknown: "Unknown",
};

const RANK: Readonly<Record<HealthState, number>> = { down: 0, degraded: 1, ok: 2, unknown: 3 };

/** Problems first (down, then delayed), then the healthy, then what can't be told. */
export const boardOrder = (cs: readonly Component[]) => [...cs].sort((a, b) => RANK[a.state] - RANK[b.state]);

/** The one-word verdict and its line: any down → Unavailable; any delayed → Delayed; prices or chain unknown → Unverified. */
export function verdict(cs: readonly Component[]): {
  word: "Live" | "Delayed" | "Unavailable" | "Unverified";
  tone: HealthState;
  line: string;
  tally: Record<HealthState, number>;
} {
  const tally: Record<HealthState, number> = { ok: 0, degraded: 0, down: 0, unknown: 0 };
  for (const c of cs) tally[c.state] += 1;
  const attention = tally.down + tally.degraded;
  const line =
    attention === 0 ? "Every system is working" : `${attention} ${attention === 1 ? "needs" : "need"} attention`;
  if (cs.length === 0) return { word: "Unverified", tone: "unknown", line: "No health reported yet", tally };
  if (tally.down > 0) return { word: "Unavailable", tone: "down", line, tally };
  if (tally.degraded > 0) return { word: "Delayed", tone: "degraded", line, tally };
  const core = cs.filter((c) => c.id === "prices" || c.id === "chain");
  if (core.some((c) => c.state === "unknown")) return { word: "Unverified", tone: "unknown", line, tally };
  return { word: "Live", tone: "ok", line, tally };
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? null : v);

/** A component's numbers in a line ("12 markets live", "Block 1 s old · RPC 140 ms"), or its own detail. */
export function metricLine(c: Component): string {
  const m = c.metrics;
  switch (c.id) {
    case "prices":
      return n(m.live) === null ? (c.detail ?? "") : `${m.live} markets live${c.detail ? ` · ${c.detail}` : ""}`;
    case "settlement":
      return n(m.overdue) === 0 ? "Every closed window settled" : (c.detail ?? "");
    case "relay":
      return n(m.pending) === 0 ? "Nothing waiting" : `${m.pending} waiting · oldest ${m.oldestSec ?? "—"} s`;
    case "keeper":
      return n(m.lastRunSec) === null
        ? (c.detail ?? "")
        : `Last run ${m.lastRunSec} s ago${m.failing ? ` · ${m.failing} failing` : ""}`;
    case "chain":
      return n(m.headAgeSec) === null ? (c.detail ?? "") : `Block ${m.headAgeSec} s old · RPC ${m.rpcLatencyMs} ms`;
    case "indexer":
      return n(m.lagBlocks) === null
        ? (c.detail ?? "")
        : m.lagBlocks === 0
          ? "Caught up"
          : `${m.lagBlocks} blocks behind`;
    default:
      return c.detail ?? "";
  }
}

/** A bar's height (a share of the strip) and tone: the worst state seen; grey and low where nothing was recorded. */
export function barOf(b: Bucket): { height: number; tone: HealthState | "none" } {
  if (!b) return { height: BAR_HEIGHT.none, tone: "none" };
  return { height: BAR_HEIGHT[b.worst], tone: b.worst };
}

const BAR_HEIGHT = { none: 0.25, ok: 0.45, unknown: 0.55, degraded: 0.8, down: 1 } as const;

const MS = 1000;
const HHMM = 5;
const TIME_START = 11;
const DAY_START = 5;
const DAY_LEN = 5;
const SECONDS_PER_DAY = 86_400;

/** A bar's moment: "14:00 UTC" for an hour, "10-12" (month-day) for a day; and its record in words. */
export function barLabel(h: Pick<StatusHistory, "from" | "bucketSec">, i: number, b: Bucket): string {
  const iso = new Date((h.from + i * h.bucketSec) * MS).toISOString();
  const when =
    h.bucketSec >= SECONDS_PER_DAY
      ? iso.slice(DAY_START, DAY_START + DAY_LEN)
      : `${iso.slice(TIME_START, TIME_START + HHMM)} UTC`;
  if (!b) return `${when} · not recorded`;
  if (b.unknown === b.seen) return `${when} · couldn't be told`;
  return `${when} · ${STATE_WORDS[b.worst]} at worst · ${b.ok} of ${b.seen - b.unknown} min working`;
}

const PERCENT = 100;
const UPTIME_DECIMALS = 2;

/**
 * The share of measured minutes that were healthy over the range ("99.86%"): minutes it couldn't be told are left out
 * (a component that isn't open has no uptime, not 0%). Null with nothing measured.
 */
export function uptimeText(buckets: readonly Bucket[]): string | null {
  let measured = 0;
  let ok = 0;
  for (const b of buckets) {
    if (!b) continue;
    measured += b.seen - b.unknown;
    ok += b.ok;
  }
  return measured <= 0 ? null : `${((ok / measured) * PERCENT).toFixed(UPTIME_DECIMALS)}%`;
}
