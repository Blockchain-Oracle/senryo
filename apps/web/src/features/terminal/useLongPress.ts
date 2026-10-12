"use client";
/**
 * Tap or hold (R5.5): a press held `HOLD_MS` runs `onHold` (with the haptic tick) and swallows the release's tap; a
 * shorter one runs `onTap`. Pointer events, so a mouse, a pen and a finger behave the same; Enter and Space still
 * click.
 */
import { useCallback, useRef } from "react";
import { fire } from "@/lib/feedback";

/** Codex direction 11 §3: hold CLOSE 450 ms for a part, hold TRAIL for the full exit. */
export const HOLD_MS = 450;

export function useLongPress(onTap: () => void, onHold: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const onPointerDown = useCallback(() => {
    held.current = false;
    if (!onHold) return;
    clear();
    timer.current = setTimeout(() => {
      held.current = true;
      fire("tick", { cue: "tap" });
      onHold();
    }, HOLD_MS);
  }, [onHold, clear]);
  const onClick = useCallback(() => {
    clear();
    if (held.current) {
      held.current = false;
      return;
    }
    onTap();
  }, [onTap, clear]);
  return { onPointerDown, onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear, onClick };
}
