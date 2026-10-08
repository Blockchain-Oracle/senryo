/** A native ceremony cannot be cancelled by discarding its UI. Keep its lock until it settles. */
export function ceremonyLifecycle() {
  let running = false;
  let generation = 0;
  let mounted = true;
  return {
    begin() {
      if (running || !mounted) return undefined;
      running = true;
      return generation;
    },
    current(id: number) {
      return mounted && id === generation;
    },
    finish() {
      running = false;
    },
    invalidate() {
      generation += 1;
    },
    mount() {
      mounted = true;
    },
    unmount() {
      mounted = false;
      generation += 1;
    },
  };
}
