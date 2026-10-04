/** Native authentication can resolve before iOS sends its foreground event. Never start signing while inactive. */
export interface ForegroundSource {
  current(): string | null;
  subscribe(listener: (state: string) => void): () => void;
}

const AUTH_FOREGROUND_TIMEOUT_MS = 5_000;
const interrupted = () => new Error("Authentication was interrupted. Review again.");

export function waitForAuthForeground(source: ForegroundSource, timeoutMs = AUTH_FOREGROUND_TIMEOUT_MS): Promise<void> {
  if (source.current() === "active") return Promise.resolve();
  if (source.current() !== "inactive") return Promise.reject(interrupted());
  return new Promise((resolve, reject) => {
    let settled = false;
    let remove = () => {};
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      remove();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(interrupted()), timeoutMs);
    const changed = (state: string | null) => {
      if (state === "active") finish();
      else if (state !== "inactive") finish(interrupted());
    };
    remove = source.subscribe(changed);
    // Cover both a transition while subscribing and a synchronous subscription callback.
    if (settled) remove();
    else changed(source.current());
  });
}
