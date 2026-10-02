import { allowScreenCaptureAsync, preventScreenCaptureAsync } from "expo-screen-capture";
import { useEffect, useState } from "react";

const NATIVE_KEY = "senryo.sensitive-content";
let owners = 0;
let protectedNative = false;
let queue: Promise<void> = Promise.resolve();
function serialize(action: () => Promise<void>): Promise<void> {
  const next = queue.then(action);
  queue = next.catch(() => {});
  return next;
}
/** One native activation shared by all reveals; overlapping owners cannot accidentally remove protection. */
export async function acquireCaptureProtection(): Promise<() => Promise<void>> {
  owners += 1;
  try {
    await serialize(async () => {
      if (!protectedNative) {
        await preventScreenCaptureAsync(NATIVE_KEY);
        protectedNative = true;
      }
    });
  } catch (error) {
    owners -= 1;
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    owners -= 1;
    await serialize(async () => {
      if (owners === 0 && protectedNative) {
        try {
          await allowScreenCaptureAsync(NATIVE_KEY);
        } finally {
          protectedNative = false;
        }
      }
    });
  };
}
export function useCaptureProtection() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    let release: (() => Promise<void>) | undefined;
    void acquireCaptureProtection()
      .then((dispose) => {
        release = dispose;
        if (mounted) setReady(true);
        else void dispose().catch(() => {});
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
      void release?.().catch(() => {});
    };
  }, []);
  return { ready, failed };
}
