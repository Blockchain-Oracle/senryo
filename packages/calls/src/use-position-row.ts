/**
 * A position row's live parts (R5.26, D-343): its head, its clock on the server's second (so it counts down by itself,
 * apart from price ticks), and its recorded PnL path — re-read on that same second.
 */
import { useServerSeconds } from "@senryo/live/react";
import { useQueryEnv } from "@senryo/query";
import type { BookEntry } from "./book.ts";
import { type PositionClock, positionClock, positionHead } from "./position-live.ts";
import { liveSamples, type ReplaySample } from "./replay.ts";

export function usePositionRow(e: BookEntry): {
  head: string;
  clock: PositionClock;
  samples: readonly ReplaySample[] | null;
  /** The server's second the clock was read on (for a ring drawn from it). */
  now: number;
} {
  const now = useServerSeconds();
  const { chainId } = useQueryEnv();
  return { head: positionHead(e), clock: positionClock(e, now), samples: liveSamples(chainId, e.key), now };
}
