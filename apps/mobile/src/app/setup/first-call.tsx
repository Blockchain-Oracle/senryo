import { useCallback, useRef } from "react";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { TerminalScreen } from "~/features/terminal/TerminalScreen";

/** The fill lands with its sound and haptic; the next step follows after the user has seen it. */
const AFTER_FILL_MS = 1_600;

/**
 * Setup — "Try your first call" (pivot onboarding step 6): the live terminal on BTC 1m with the test dollars just
 * granted. The first fill moves setup on; Skip is always there.
 */
export default function FirstCallStep() {
  const { next } = useSetupNav("first-call");
  const done = useRef(false);
  const onFilled = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setTimeout(next, AFTER_FILL_MS);
  }, [next]);
  return <TerminalScreen coach={{ title: "Try your first call", onSkip: next }} onFilled={onFilled} />;
}
