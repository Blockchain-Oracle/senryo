/**
 * The clock for "updated 3m ago" lines (D-020 honesty). An age computed from `Date.now()` during render only moves
 * when something else re-renders — a closed market whose oracle is quiet would keep saying "just now", and the React
 * Compiler may keep the first value outright. This is state on a timer instead, so every age line re-reads the time.
 */
import { useEffect, useState } from "react";

/** Ages are worded in minutes at the finest ("4m ago"), so a 15 s tick keeps them true without busy re-renders. */
const AGE_TICK_MS = 15_000;
const MS_PER_SECOND = 1000;

const nowSec = () => BigInt(Math.floor(Date.now() / MS_PER_SECOND));

/** Unix seconds, refreshed every 15 s while mounted. */
export function useNowSec(): bigint {
  const [now, setNow] = useState(nowSec);
  useEffect(() => {
    const id = setInterval(() => setNow(nowSec()), AGE_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}
