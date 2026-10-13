/**
 * The server clock's offset as a shared value, for rings and charts that redraw on the UI thread (`CountdownRing`):
 * re-read from the live clock every few seconds, so a countdown is the server's, not the phone's.
 */
import { useLive } from "@senryo/live/react";
import { useEffect } from "react";
import { type SharedValue, useSharedValue } from "react-native-reanimated";

const CLOCK_SYNC_MS = 5_000;

export function useClockOffset(): SharedValue<number> {
  const live = useLive();
  const offsetMs = useSharedValue(live.clock.offset);
  useEffect(() => {
    offsetMs.value = live.clock.offset;
    const id = setInterval(() => {
      offsetMs.value = live.clock.offset;
    }, CLOCK_SYNC_MS);
    return () => clearInterval(id);
  }, [live, offsetMs]);
  return offsetMs;
}
