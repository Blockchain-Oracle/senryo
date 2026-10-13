/**
 * Replays in React (R5.19, `replay.ts`): the book provider records every open position while the app is open, and a
 * receipt reads the episode of its trade once it has ended.
 */
import { useEffect, useSyncExternalStore } from "react";
import {
  type Episode,
  episodeId,
  persistReplays,
  REPLAY_SAMPLE_MS,
  recordBook,
  replaysNow,
  subscribeReplays,
} from "./replay.ts";
import type { LiveBook } from "./use-live-book.ts";

/** Samples the book every 200 ms once it has loaded; what was recorded is saved when this stops. */
export function useReplayRecorder(get: () => LiveBook, chainId: number): void {
  useEffect(() => {
    const timer = setInterval(() => {
      const book = get();
      if (book.ready) recordBook(book.entries, chainId, Date.now());
    }, REPLAY_SAMPLE_MS);
    return () => {
      clearInterval(timer);
      persistReplays();
    };
  }, [get, chainId]);
}

/** The ended trade's episode on this device (null when it wasn't recorded here). */
export function useEpisode(chainId: number, bookKey: string): Episode | null {
  const all = useSyncExternalStore(subscribeReplays, replaysNow, replaysNow);
  const id = episodeId(chainId, bookKey);
  return all.find((e) => e.id === id && e.closedAtMs !== null) ?? null;
}
