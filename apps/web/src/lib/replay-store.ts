"use client";
/**
 * Where the web keeps replays (R5.19, `@senryo/calls` `replay.ts`): this browser's storage, saved when an episode ends
 * and when the page hides. Blocked or full storage leaves them for this visit.
 */
import { configureReplayStore, persistReplays } from "@senryo/calls";

configureReplayStore({
  read: (key) => {
    try {
      return globalThis.localStorage?.getItem(key);
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Full or blocked: the replays last for this visit.
    }
  },
});

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistReplays();
  });
}
