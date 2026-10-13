"use client";
/**
 * Where the web keeps visits (R6, D-337, `@senryo/search` `visits.ts`): this browser's storage — search's Recents and
 * frecency, and the market picker's recent markets. Blocked storage keeps them for this visit.
 */
import { configureVisitStore } from "@senryo/search";

configureVisitStore({
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
      // Full or blocked: the visits last for this visit.
    }
  },
  remove: (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  },
});
