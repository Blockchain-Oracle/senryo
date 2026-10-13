/**
 * The dev-only restraint inspector (Q0, D-346 rule 5; the web's `fact-inspector`): every mounted `FactList` registers
 * its facts; the same fact (label and value) drawn twice on one screen, or a list at rest holding more than it should,
 * is reported once in the console — never in a release build. Deadlines register the same way (`useClockInspector`):
 * one deadline with two clocks on screen is reported (D-348).
 */
import { useEffect } from "react";

const MS = 1_000;
const mounted = new Map<string, number>();
const told = new Set<string>();

function hold(key: string, what: string): () => void {
  mounted.set(key, (mounted.get(key) ?? 0) + 1);
  if ((mounted.get(key) ?? 0) > 1 && !told.has(key)) {
    told.add(key);
    console.warn(`[restraint] ${what} — say it once (D-346).`);
  }
  return () => {
    const n = (mounted.get(key) ?? 1) - 1;
    if (n <= 0) mounted.delete(key);
    else mounted.set(key, n);
  };
}

export function useFactInspector(facts: readonly { label: string; value: string | null }[], max: number | null): void {
  const sig = facts.map((f) => `${f.label}=${f.value ?? ""}`).join("|");
  useEffect(() => {
    if (!__DEV__) return;
    const list = sig.split("|").filter(Boolean);
    if (max !== null && list.length > max) console.warn(`[restraint] ${list.length} facts at rest (at most ${max})`);
    const releases = list.map((f) => hold(`fact:${f}`, `"${f}" drawn twice`));
    return () => {
      for (const release of releases) release();
    };
  }, [sig, max]);
}

/** A countdown to `deadlineSec` is on screen; a second one to the same deadline is reported (D-348). */
export function useClockInspector(deadlineSec: number | null, what: string): void {
  useEffect(() => {
    if (!__DEV__ || deadlineSec === null) return;
    return hold(`clock:${deadlineSec}`, `two clocks to ${new Date(deadlineSec * MS).toISOString()} (${what})`);
  }, [deadlineSec, what]);
}
