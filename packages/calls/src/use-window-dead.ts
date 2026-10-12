/**
 * A lane whose window can't take a call (R5.25): `Windows.openWindow` accepts a window only within its print's
 * admission after the start, and the first call opens it — so a lane longer than that (15m, 1h on Pyth) whose window
 * nobody called in time is closed to calls until the next one. Shorter lanes never are.
 */
import { admissionSecOf, MARKETS } from "@senryo/config";
import { useWindowOpened } from "@senryo/query";
import type { CallWindowView } from "./use-call-window.ts";

export function useWindowDead(t: Pick<CallWindowView, "symbol" | "cadenceSec" | "window" | "now">): boolean {
  const spec = MARKETS.find((m) => m.symbol === t.symbol);
  const admission = spec ? admissionSecOf(spec) : t.cadenceSec;
  const long = t.cadenceSec > admission;
  const openable = t.now <= t.window.start + admission;
  const state = useWindowOpened(t.window.windowId, long && t.window.trading && t.now > 0, openable);
  return long && !openable && "value" in state && !state.value.opened;
}
