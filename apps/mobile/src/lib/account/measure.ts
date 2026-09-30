/**
 * S6.10 measurement sink (native): prompt counts per ceremony, flow timings, TTFT — an MMKV ring buffer that
 * Account → Diagnostics shows, so the user can read prompt counts per authenticator (iCloud / GPM / 1Password) off
 * each device. No secrets in any event. S12 posts them to `/v1/events`.
 */
import type { MeasureEvent } from "@senryo/account";
import { MEASURE_MAX_EVENTS } from "~/lib/constants/auth";
import { STORAGE_KEYS, storage } from "~/lib/storage";

const listeners = new Set<() => void>();
let cache: readonly MeasureEvent[] | undefined;

function load(): readonly MeasureEvent[] {
  if (cache) return cache;
  try {
    const raw = storage.getString(STORAGE_KEYS.measure);
    cache = raw ? (JSON.parse(raw) as MeasureEvent[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function emit() {
  for (const l of listeners) l();
}

export function recordMeasure(event: MeasureEvent): void {
  const next = [...load(), event].slice(-MEASURE_MAX_EVENTS);
  cache = next;
  storage.set(STORAGE_KEYS.measure, JSON.stringify(next));
  emit();
}

export const measureStore = {
  get: load,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  clear() {
    cache = [];
    storage.remove(STORAGE_KEYS.measure);
    emit();
  },
};

/** TTFT (D-037): starts on the first launch with no account; stops at the first confirmed user-signed tx. */
let taps = 0;

export function ttftStart(now: number): void {
  if (load().some((e) => e.type === "ttft")) return;
  taps = 0;
  recordMeasure({ type: "ttft", phase: "start", taps: 0, at: now });
}

/** Counted by the primary actions on the path (Create account, Claim) — the tap count the plan asks for. */
export function ttftTap(): void {
  taps += 1;
}

export function ttftStop(now: number): void {
  const events = load();
  if (!events.some((e) => e.type === "ttft" && e.phase === "start")) return;
  if (events.some((e) => e.type === "ttft" && e.phase === "stop")) return;
  recordMeasure({ type: "ttft", phase: "stop", taps, at: now });
}
