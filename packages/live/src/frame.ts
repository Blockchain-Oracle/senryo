// One flush per display frame: many ticks inside a frame notify each listener once (D-272 "flushes batched per frame").
type Flush = () => void;
const FALLBACK_FRAME_MS = 16;

const raf: (cb: () => void) => unknown =
  typeof globalThis.requestAnimationFrame === "function"
    ? (cb) => globalThis.requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, FALLBACK_FRAME_MS);

/** Calls `flush` on the next frame, once, however many times it is scheduled before then. */
export function frameScheduler(flush: Flush): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    raf(() => {
      pending = false;
      flush();
    });
  };
}
