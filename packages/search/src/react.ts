/** The visits as React state: re-renders when something is opened, so Recents and frecency stay current. */
import { useSyncExternalStore } from "react";
import { subscribeVisits, visitsVersion } from "./visits.ts";

const SERVER_VERSION = 0;

export function useVisitsVersion(): number {
  return useSyncExternalStore(subscribeVisits, visitsVersion, () => SERVER_VERSION);
}
