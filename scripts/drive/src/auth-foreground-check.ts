import assert from "node:assert/strict";
import { waitForAuthForeground } from "../../../apps/mobile/src/lib/account/foreground.ts";

const TEST_TIMEOUT_MS = 5;
function source(initial: string) {
  let state = initial;
  const listeners = new Set<(state: string) => void>();
  return {
    current: () => state,
    subscribe: (listener: (state: string) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    change: (next: string) => {
      state = next;
      for (const listener of listeners) listener(next);
    },
    count: () => listeners.size,
  };
}

const active = source("active");
await waitForAuthForeground(active);
assert.equal(active.count(), 0);
const dismissing = source("inactive");
let proceeded = false;
const ready = waitForAuthForeground(dismissing).then(() => {
  proceeded = true;
});
await Promise.resolve();
assert.equal(proceeded, false);
dismissing.change("active");
await ready;
assert.equal(proceeded, true);
assert.equal(dismissing.count(), 0);
const away = source("inactive");
const rejected = assert.rejects(waitForAuthForeground(away), /interrupted/);
away.change("background");
await rejected;
assert.equal(away.count(), 0);
await assert.rejects(waitForAuthForeground(source("background")), /interrupted/);
const timedOut = source("inactive");
await assert.rejects(waitForAuthForeground(timedOut, TEST_TIMEOUT_MS), /interrupted/);
assert.equal(timedOut.count(), 0);
const racing = source("inactive");
await waitForAuthForeground({
  current: racing.current,
  subscribe: (listener) => {
    const remove = racing.subscribe(listener);
    racing.change("active");
    return remove;
  },
});
assert.equal(racing.count(), 0);
console.log(
  "Authentication foreground checks passed: immediate, dismissal, background, timeout and subscription race.",
);
