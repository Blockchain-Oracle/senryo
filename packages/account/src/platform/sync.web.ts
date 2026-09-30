/**
 * Cross-tab session sync over BroadcastChannel (F64). One live signing key across tabs: when a tab unlocks, the others
 * lock ("Unlocked in another tab"); a lock or sign-out in any tab reaches every tab.
 */
import { STORAGE } from "../constants.ts";
import type { SessionSync, SyncEvent } from "./types.ts";

const TAB_ID_RADIX = 36;

function tabId(): string {
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return (bytes[0] ?? 0).toString(TAB_ID_RADIX);
}

export function createSessionSync(): SessionSync {
  const tab = tabId();
  const channel = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(STORAGE.channel);
  const listeners = new Set<(event: SyncEvent) => void>();
  if (channel) {
    channel.onmessage = (message: MessageEvent<SyncEvent>) => {
      if (message.data?.tab === tab) return;
      for (const listener of listeners) listener(message.data);
    };
  }
  return {
    tab,
    publish(event) {
      channel?.postMessage(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      listeners.clear();
      channel?.close();
    },
  };
}
