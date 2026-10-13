/**
 * What Home's floating search does on its own (R6.9, the owner's review 13 Oct): it steps out of the way while you
 * read down the page and comes back the moment you scroll up — near the top and at the end it always shows — all on
 * the UI thread; and while it rests, its words walk through what search can do right now (today's biggest move, your
 * open position, a lane, a receipt), live from the same reads as the page, still under Reduce Motion.
 */
import { dayChange } from "@senryo/calls";
import { useBookPositions, useDayLine, useHotSymbols } from "@senryo/calls/react";
import { MARKETS } from "@senryo/config";
import { useSampledPrice } from "@senryo/live/react";
import { useEffect, useMemo, useState } from "react";
import {
  type SharedValue,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useHideBalances } from "~/lib/hide-balances";
import { activeNetwork } from "~/lib/network";
import { EASE, TIMING } from "~/theme";

/** Down this far in one go hides it; up this far shows it (a little hysteresis, so a jittery thumb doesn't flicker). */
const HIDE_AFTER = 24;
const SHOW_AFTER = 12;
/** Within this of the top or the end it always shows. */
const EDGE = 32;
const HINT_MS = 3_200;
const TAIL_MS = 1_000;

export const BASE_HINT = "Search for anything";

/** 1 shown, 0 tucked behind the dock; Home's scroll drives it. */
export function useLauncherScroll(): {
  shown: SharedValue<number>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
} {
  const shown = useSharedValue(1);
  const last = useSharedValue(0);
  const travel = useSharedValue(0);
  const target = useSharedValue(1);
  const reduce = useReducedMotion();
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const dy = y - last.value;
      last.value = y;
      // A change of direction starts the count again.
      travel.value = Math.sign(dy) === Math.sign(travel.value) ? travel.value + dy : dy;
      const atTop = y < EDGE;
      const atEnd = e.contentSize.height - e.layoutMeasurement.height - y < EDGE;
      let next = target.value;
      if (atTop || atEnd || travel.value < -SHOW_AFTER) next = 1;
      else if (travel.value > HIDE_AFTER) next = 0;
      if (next !== target.value) {
        target.value = next;
        shown.value = withTiming(next, { duration: reduce ? 0 : TIMING.selection, easing: EASE });
      }
    },
  });
  return { shown, onScroll };
}

function useMoverHint(): string | null {
  const hot = useHotSymbols(MARKETS);
  const symbol = hot[0];
  const day = useDayLine(symbol ?? "");
  const now = useSampledPrice(symbol ?? "", TAIL_MS);
  if (!symbol || !day || now === undefined) return null;
  const c = dayChange(day.openE8, now);
  return `${symbol} ${c.text.replace(/^[↑↓]\s*/, "")} today`;
}

/** The words the launcher walks through, live; the base line alone under Reduce Motion or while it's tucked away. */
export function useLauncherHint(active: boolean): string {
  const reduce = useReducedMotion();
  const mover = useMoverHint();
  const positions = useBookPositions();
  const [hidden] = useHideBalances();
  const first = positions[0];
  const practice = activeNetwork().key === "testnet";
  const hints = useMemo(
    () =>
      [
        BASE_HINT,
        mover,
        first && !hidden ? `Find your ${first.symbol} ${first.label}` : null,
        "Try “btc 5m”",
        practice ? "“deposit” finds test dollars" : "“deposit” finds Add money",
        "Paste a receipt or tx hash",
      ].filter((h): h is string => h !== null),
    [mover, first, hidden, practice],
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce || !active) {
      setI(0);
      return;
    }
    const t = setInterval(() => setI((n) => n + 1), HINT_MS);
    return () => clearInterval(t);
  }, [reduce, active]);
  return hints[i % hints.length] ?? BASE_HINT;
}
