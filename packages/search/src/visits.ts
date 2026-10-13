/**
 * Visits (R6.2): what this device opened — from search, the market picker, a market row — counted and dated, kept on
 * the device (each app gives the store, `configureVisitStore`). They feed frecency (a boost that halves every week and
 * is capped, so habit lifts a hit without burying a better one) and Recents, the empty view's first section and the
 * market picker's recent markets (the one recents list; the picker's own was folded in, its old key read once).
 */

export interface VisitStore {
  read: (key: string) => string | null | undefined;
  write: (key: string, value: string) => void;
  remove: (key: string) => void;
}

interface Visit {
  id: string;
  /** Times opened. */
  n: number;
  /** Last opened, ms. */
  at: number;
}

const KEY = "senryo.search.visits.v1";
/** The market picker's recents before R6 (a JSON list of symbols, newest first): read into visits once. */
const LEGACY_MARKET_RECENTS = "senryo.recent-markets.v1";
const MAX_VISITS = 80;
const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 7;
const HALF_LIFE_MS = HALF_LIFE_DAYS * DAY_MS;
/** The most a habit multiplies a hit's score by (1 + this). */
const MAX_BOOST = 1.2;
/** A migrated recent is dated this far apart, keeping the old order. */
const LEGACY_STEP_MS = 60_000;
/** The same thing opened again within this long is one visit (a remount, a double tap). */
const SAME_VISIT_MS = 1_500;

let store: VisitStore | null = null;
let visits: Visit[] = [];
let hydrated = false;
let version = 0;
const listeners = new Set<() => void>();

export function configureVisitStore(s: VisitStore): void {
  store = s;
  hydrated = false;
}

function isVisit(v: unknown): v is Visit {
  const o = v as Visit | null;
  return typeof o?.id === "string" && typeof o.n === "number" && typeof o.at === "number";
}

function legacy(s: VisitStore, now: number): Visit[] {
  try {
    const raw = s.read(LEGACY_MARKET_RECENTS);
    const list: unknown = raw ? JSON.parse(raw) : [];
    s.remove(LEGACY_MARKET_RECENTS);
    return Array.isArray(list)
      ? list
          .filter((x): x is string => typeof x === "string")
          .map((symbol, i) => ({ id: `market:${symbol}`, n: 1, at: now - i * LEGACY_STEP_MS }))
      : [];
  } catch {
    return [];
  }
}

function hydrate(): void {
  if (hydrated || !store) return;
  hydrated = true;
  try {
    const raw = store.read(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    visits = Array.isArray(parsed) ? parsed.filter(isVisit) : legacy(store, Date.now());
  } catch {
    visits = [];
  }
}

function save(): void {
  version++;
  try {
    store?.write(KEY, JSON.stringify(visits));
  } catch {
    // The list still serves this session.
  }
  for (const l of listeners) l();
}

/** Something was opened: count it and date it now. */
export function recordVisit(id: string, now = Date.now()): void {
  hydrate();
  const held = visits.find((v) => v.id === id);
  if (held && now - held.at < SAME_VISIT_MS && visits[0] === held) return;
  const next: Visit = { id, n: (held?.n ?? 0) + 1, at: now };
  visits = [next, ...visits.filter((v) => v.id !== id)].slice(0, MAX_VISITS);
  save();
}

/** Forget one (a recents row's remove). */
export function forgetVisit(id: string): void {
  hydrate();
  visits = visits.filter((v) => v.id !== id);
  save();
}

/** Ids by when they were last opened, newest first; `prefix` keeps one kind (`market:`). */
export function recentIds(count: number, prefix = ""): string[] {
  hydrate();
  return visits
    .filter((v) => v.id.startsWith(prefix))
    .slice(0, count)
    .map((v) => v.id);
}

/** Frecency as a score multiplier: 1 for never, up to 1 + MAX_BOOST for a daily habit. */
export function visitBoost(id: string, now = Date.now()): number {
  hydrate();
  const v = visits.find((x) => x.id === id);
  if (!v) return 1;
  const weight = v.n * 2 ** -(Math.max(0, now - v.at) / HALF_LIFE_MS);
  return 1 + Math.min(MAX_BOOST, Math.log1p(weight) / 2);
}

export function subscribeVisits(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes whenever the visits do (for `useSyncExternalStore`). */
export function visitsVersion(): number {
  hydrate();
  return version;
}
