import { useCallback, useState } from "react";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { TerminalScreen } from "~/features/terminal/TerminalScreen";

/**
 * Setup — "Try your first call" (pivot onboarding step 6): the live terminal on BTC 1m with the test dollars just
 * granted. Once the call fills, the page stays: the user watches it breathe on the chart (cash out, or the result
 * reveal at the close) and moves on with Continue when they choose. Skip is there until then.
 */
export default function FirstCallStep() {
  const { next } = useSetupNav("first-call");
  const [live, setLive] = useState(false);
  const onFilled = useCallback(() => setLive(true), []);
  return (
    <TerminalScreen
      coach={
        live
          ? { title: "Your call is live", action: "Continue", onAction: next }
          : { title: "Try your first call", action: "Skip", onAction: next }
      }
      onFilled={onFilled}
    />
  );
}
