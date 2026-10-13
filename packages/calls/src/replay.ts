/**
 * Trade replays (R5.19; Tradash's `tradash.replays.v1` by way of Owarine's `replay.ts`): while a position is open the
 * device samples its price every 200 ms with the live PnL beside it — so a replay shows the PnL the screen showed, not a
 * recomputation — halving the resolution past 900 samples. Kept on the device (the app gives the store, `configure
 * ReplayStore`): at most 150 episodes and about 1.5 MB, falling back to the newest 20; saved when an episode ends and
 * when the app hides. A replay plays back in at most 12 s; one with too little of its life recorded says so.
 */
import type { BookEntry } from "./book.ts";

/** [time ms, price, PnL e-6 as an integer string (null where unknown)]. */
export type ReplaySample = [number, number, string | null];

export interface Episode {
  /** `<chainId>:<book key>` ("10143:call:1021"). */
  id: string;
  kind: "call" | "ride";
  symbol: string;
  /** "Up", "Down", "Range"… */
  label: string;
  up: boolean | null;
  /** The fill's price and a call's line (prices as numbers). */
  entry: number | null;
  line: number | null;
  openedAtMs: number;
  closedAtMs: number | null;
  samples: ReplaySample[];
}

export interface ReplayStore {
  read: (key: string) => string | null | undefined;
  write: (key: string, value: string) => void;
}

export const REPLAY_SAMPLE_MS = 200;
/** A replay plays in at most this long, whatever the trade lasted. */
export const REPLAY_PLAY_MS = 12_000;
const KEY = "senryo.replays.v1";
const HALVE_AT = 900;
const MAX_EPISODES = 150;
const MAX_CHARS = 1_500_000;
const FALLBACK_EPISODES = 20;
/** A gap longer than this is a hole in the recording (the app was closed or the stream down). */
const GAP_MS = 3_000;
/** Tradash's rule: enough samples, enough of the life covered, no hole in the middle 80 %. */
const REPLAYABLE = { samples: 30, coverage: 0.6, edge: 0.1 } as const;
const E8 = 1e8;

let store: ReplayStore | null = null;
let episodes: Episode[] = [];
let hydrated = false;
let dirty = false;
const listeners = new Set<() => void>();

export function configureReplayStore(s: ReplayStore): void {
  store = s;
  hydrated = false;
}

function hydrate(): void {
  if (hydrated || !store) return;
  hydrated = true;
  try {
    const raw = store.read(KEY);
    const parsed = raw ? (JSON.parse(raw) as Episode[]) : [];
    episodes = Array.isArray(parsed) ? parsed.filter((e) => typeof e?.id === "string" && Array.isArray(e.samples)) : [];
  } catch {
    episodes = [];
  }
}

/** Saves what changed (an episode ended, or the app is hiding). */
export function persistReplays(): void {
  if (!dirty || !store) return;
  dirty = false;
  try {
    let list = episodes.slice(0, MAX_EPISODES);
    let text = JSON.stringify(list);
    if (text.length > MAX_CHARS) {
      list = list.slice(0, FALLBACK_EPISODES);
      text = JSON.stringify(list);
    }
    store.write(KEY, text);
  } catch {
    // Storage full or blocked: the replays last for this run.
  }
}

const notify = () => {
  episodes = [...episodes];
  for (const l of listeners) l();
};

export function subscribeReplays(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function replaysNow(): readonly Episode[] {
  hydrate();
  return episodes;
}

export const episodeId = (chainId: number, bookKey: string) => `${chainId}:${bookKey}`;

/** Keeps every other sample once there are too many (the first and the last always stay). */
export function halve(samples: ReplaySample[]): ReplaySample[] {
  if (samples.length <= HALVE_AT) return samples;
  const out = samples.filter((_, i) => i % 2 === 0);
  const last = samples.at(-1);
  if (last && out.at(-1) !== last) out.push(last);
  return out;
}

/** How much of the episode's time the samples cover (gaps over 3 s count as uncovered). */
export function coverage(e: Pick<Episode, "samples">): number {
  const s = e.samples;
  const first = s[0];
  const last = s.at(-1);
  if (!first || !last || s.length < 2) return 0;
  const span = last[0] - first[0];
  if (span <= 0) return 0;
  let covered = 0;
  for (let i = 1; i < s.length; i++) {
    const d = (s[i]?.[0] ?? 0) - (s[i - 1]?.[0] ?? 0);
    if (d <= GAP_MS) covered += d;
  }
  return covered / span;
}

export function replayable(e: Episode): boolean {
  const s = e.samples;
  const first = s[0];
  const last = s.at(-1);
  if (!first || !last || s.length < REPLAYABLE.samples || coverage(e) < REPLAYABLE.coverage) return false;
  const span = last[0] - first[0];
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]?.[0] ?? 0;
    const b = s[i]?.[0] ?? 0;
    const mid = (a + b) / 2 - first[0];
    if (mid > span * REPLAYABLE.edge && mid < span * (1 - REPLAYABLE.edge) && b - a > GAP_MS) return false;
  }
  return true;
}

/** The PnL at time `t` (e-6): the last recorded one at or before it. */
export function pnlAt(samples: readonly ReplaySample[], t: number): bigint {
  let out: string | null = null;
  for (const [ts, , pnl] of samples) {
    if (ts > t) break;
    if (pnl !== null) out = pnl;
  }
  return out === null ? 0n : BigInt(out);
}

/** How long the playback of `e` runs: its life, at most 12 s. */
export function playMs(e: Episode): number {
  const first = e.samples[0]?.[0] ?? 0;
  const last = e.samples.at(-1)?.[0] ?? first;
  return Math.min(REPLAY_PLAY_MS, Math.max(1, last - first));
}

const num = (e8: bigint | null | undefined) => (e8 === null || e8 === undefined ? null : Number(e8) / E8);

/**
 * One sampling pass over the book (`chainId`'s open positions): every priced entry adds a sample at most every 200 ms,
 * and an episode whose position left the book ends. Call it only once the book has loaded.
 */
export function recordBook(entries: readonly BookEntry[], chainId: number, now: number): void {
  hydrate();
  const open = new Set<string>();
  for (const entry of entries) {
    const id = episodeId(chainId, entry.key);
    open.add(id);
    const price = num(entry.markE8);
    if (price === null || entry.state === "opening") continue;
    let e = episodes.find((x) => x.id === id && x.closedAtMs === null);
    if (!e) {
      e = {
        id,
        kind: entry.kind,
        symbol: entry.symbol,
        label: entry.label,
        up: entry.up,
        entry: num(entry.entryE8),
        line: num(entry.call?.lineE8),
        openedAtMs: now,
        closedAtMs: null,
        samples: [],
      };
      episodes = [e, ...episodes];
    }
    const last = e.samples.at(-1);
    if (!last || now - last[0] >= REPLAY_SAMPLE_MS) {
      // In place: copying the whole path five times a second cost more than the sample.
      e.samples.push([now, price, entry.pnl === null ? null : entry.pnl.toString()]);
      if (e.samples.length > HALVE_AT) e.samples = halve(e.samples);
      dirty = true;
    }
  }
  const prefix = `${chainId}:`;
  let closed = false;
  for (const e of episodes) {
    if (e.closedAtMs === null && e.id.startsWith(prefix) && !open.has(e.id)) {
      e.closedAtMs = now;
      dirty = true;
      closed = true;
    }
  }
  if (closed) {
    notify();
    persistReplays();
  }
}
