/**
 * S6.10 measurement sink (web): prompt counts per ceremony, flow timings and TTFT, kept in a local ring buffer the
 * Account → Diagnostics panel shows (the user reads them off each authenticator for the S6 device report). No secrets:
 * the events carry only flow names, counts, ms and public outcomes. S12 posts them to `/v1/events`.
 */
import type { MeasureEvent } from "@senryo/account";
import { AUTH_STORAGE, MEASURE_MAX_EVENTS } from "@/lib/constants/auth";
import { readJson, removeKey, writeJson } from "./local";

const listeners = new Set<() => void>();
let cache: readonly MeasureEvent[] | undefined;

function load(): readonly MeasureEvent[] {
  cache ??= readJson(AUTH_STORAGE.measure, (v) => (Array.isArray(v) ? (v as MeasureEvent[]) : undefined)) ?? [];
  return cache;
}

export function recordMeasure(event: MeasureEvent): void {
  const next = [...load(), event].slice(-MEASURE_MAX_EVENTS);
  cache = next;
  writeJson(AUTH_STORAGE.measure, next);
  for (const l of listeners) l();
}

export const measureStore = {
  get: load,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  clear() {
    cache = [];
    removeKey(AUTH_STORAGE.measure);
    for (const l of listeners) l();
  },
};

/** TTFT (D-037): starts on the first landing with no account; stops at the first confirmed user-signed tx. */
let taps = 0;
let counting = false;

function onTap() {
  taps += 1;
}

export function ttftStart(now: number): void {
  if (load().some((e) => e.type === "ttft")) return;
  recordMeasure({ type: "ttft", phase: "start", taps: 0, at: now });
  counting = true;
  taps = 0;
  document.addEventListener("pointerdown", onTap, { capture: true, passive: true });
}

export function ttftStop(now: number): void {
  const events = load();
  const started = events.some((e) => e.type === "ttft" && e.phase === "start");
  const stopped = events.some((e) => e.type === "ttft" && e.phase === "stop");
  if (!started || stopped) return;
  recordMeasure({ type: "ttft", phase: "stop", taps: counting ? taps : 0, at: now });
  counting = false;
  document.removeEventListener("pointerdown", onTap, { capture: true });
}
