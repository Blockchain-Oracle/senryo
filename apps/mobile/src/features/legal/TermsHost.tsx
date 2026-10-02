/**
 * Setup's last step is the terms sheet over Home (A2 step 4; Fomo F08 shows it over the loaded Home). This headless
 * host raises it whenever the account owes it and the tab shell is on screen — after "Go to Home", after a relaunch
 * that killed the app on that step, and again if it was somehow closed before agreeing (it has no Skip).
 */
import { type Href, router, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { pendingSetupStep } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";

export function TermsHost() {
  const account = useAccount();
  const segments = useSegments() as string[];
  const raised = useRef(false);
  const onTabs = segments[0] === "(tabs)";
  const showing = segments.includes("terms");
  const owed = account.ready && pendingSetupStep(account.hint?.address) === "terms";
  useEffect(() => {
    if (showing) {
      raised.current = false;
      return;
    }
    if (!owed || !onTabs || raised.current) return;
    raised.current = true;
    router.push(`${ROUTES.termsSheet}?setup=1` as Href);
  }, [owed, onTabs, showing]);
  return null;
}
