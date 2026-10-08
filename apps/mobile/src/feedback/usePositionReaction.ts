import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import { useReducedMotion } from "react-native-reanimated";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { fire } from "./fire";
import { MovementBaseline } from "./movement";

export function usePositionReaction(key: string, sourceMs: number, pnlUsd6: bigint, fresh: boolean): void {
  const baseline = useRef(new MovementBaseline());
  const reduced = useReducedMotion();
  const [enabled] = useMMKVBoolean(STORAGE_KEYS.tradeReactions, storage);
  useEffect(() => {
    const listener = AppState.addEventListener("change", () => {
      baseline.current = new MovementBaseline();
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const direction = baseline.current.observe(
      key,
      sourceMs,
      pnlUsd6,
      Date.now(),
      Boolean(enabled) && fresh && !reduced && AppState.currentState === "active",
    );
    // Existing owned cues, no victory/loss sound from an unrealized mark.
    if (direction) fire("tick");
  }, [key, sourceMs, pnlUsd6, fresh, enabled, reduced]);
}
