// React bindings for the live layer. Lists and labels use these (one render per frame at most); the terminal's chart
// and odometers bypass React entirely through `live.prices.subscribe` into shared values (zero renders per tick).
import { createContext, createElement, type ReactNode, useContext, useEffect, useSyncExternalStore } from "react";
import type { Live } from "./live.ts";
import type { BoundaryPrint } from "./prints.ts";
import type { StreamStatus } from "./sse.ts";

const MS_PER_SECOND = 1000;
const LiveContext = createContext<Live | null>(null);

export function LiveProvider({ live, children }: { live: Live; children: ReactNode }) {
  return createElement(LiveContext.Provider, { value: live }, children);
}

export function useLive(): Live {
  const live = useContext(LiveContext);
  if (!live) throw new Error("useLive outside LiveProvider");
  return live;
}

/** Hold the stream open while this component is mounted. */
export function useLiveStream(): void {
  const live = useLive();
  useEffect(() => live.stream.acquire(), [live]);
}

/** The latest price × 1e8 for `symbol` (undefined before the first tick); re-renders at most once per frame. */
export function useLivePrice(symbol: string): number | undefined {
  const live = useLive();
  useLiveStream();
  return useSyncExternalStore(
    (cb) => live.prices.subscribe(symbol, cb),
    () => live.prices.latest(symbol)?.priceE8,
  );
}

export function useStreamStatus(): StreamStatus {
  const live = useLive();
  return useSyncExternalStore(
    (cb) => live.onStreamStatus(cb),
    () => live.streamStatus,
  );
}

/** Server time in whole seconds, re-rendering once a second (countdown text in lists). */
export function useServerSeconds(): number {
  const live = useLive();
  return useSyncExternalStore(
    (cb) => {
      let timer: ReturnType<typeof setTimeout>;
      const tick = () => {
        cb();
        timer = setTimeout(tick, MS_PER_SECOND - (live.clock.now() % MS_PER_SECOND));
      };
      timer = setTimeout(tick, MS_PER_SECOND - (live.clock.now() % MS_PER_SECOND));
      return () => clearTimeout(timer);
    },
    () => live.clock.nowSec(),
  );
}

/** The boundary print for `symbol` at second `t`, once it has streamed. */
export function useBoundaryPrint(symbol: string, t: number): BoundaryPrint | undefined {
  const live = useLive();
  return useSyncExternalStore(
    (cb) => live.prints.subscribe(cb),
    () => live.prints.at(symbol, t),
  );
}
