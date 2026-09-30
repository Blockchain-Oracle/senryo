/** Native: one process holds one session, so cross-tab sync is a no-op (lock-on-background is wired by the app). */
import type { SessionSync } from "./types.ts";

export function createSessionSync(): SessionSync {
  return {
    tab: "native",
    publish() {},
    subscribe() {
      return () => {};
    },
    close() {},
  };
}
