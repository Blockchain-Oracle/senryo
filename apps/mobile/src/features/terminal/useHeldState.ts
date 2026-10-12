/**
 * A held position's button state for React (R5.5): whether TRAIL is armed or may arm, and whether CLOSE has an amount
 * — written by the tick passes every tick but rendered only when one of them flips (the captions and the amount roll
 * in shared values without React).
 */
import { useCallback, useRef, useState } from "react";

export interface HeldState {
  armed: boolean;
  ready: boolean;
  closable: boolean;
}

const same = (a: HeldState | null, b: HeldState | null) =>
  a === b || (a !== null && b !== null && a.armed === b.armed && a.ready === b.ready && a.closable === b.closable);

export function useHeldState() {
  const [state, setState] = useState<HeldState | null>(null);
  const last = useRef<HeldState | null>(null);
  const write = useCallback((next: HeldState | null) => {
    if (same(last.current, next)) return;
    last.current = next;
    setState(next);
  }, []);
  return [state, write] as const;
}
