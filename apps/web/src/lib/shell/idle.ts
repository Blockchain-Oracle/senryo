import { IDLE_FALLBACK_MS, IDLE_TIMEOUT_MS } from "@/lib/feedback/constants";

/**
 * Runs `fn` when the main thread is idle after hydration (or after 1.5 s at the latest): islands the user is likely to
 * open — Everything, the sound engine — preload here, so they stay out of the first load and still open instantly.
 */
export function onIdle(fn: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, IDLE_FALLBACK_MS);
  return () => clearTimeout(id);
}
