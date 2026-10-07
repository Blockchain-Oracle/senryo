/** Terms open over Home before Face ID for new accounts; legacy accounts retain their remaining order.
 * A previous money-action acknowledgement completes the same legal version without asking twice.
 */
import { type Href, router, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { useMMKVString } from "react-native-mmkv";
import { completeSetupStep, pendingSetupStep } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { hasAcknowledgedTerms } from "./acknowledged";

export function TermsHost() {
  const account = useAccount();
  useMMKVString(STORAGE_KEYS.setup, storage);
  const segments = useSegments() as string[];
  const raised = useRef(false);
  const onTabs = segments[0] === "(tabs)";
  const showing = segments.includes("terms");
  const address = account.hint?.address;
  const owed = account.ready && pendingSetupStep(address) === "terms";
  useEffect(() => {
    // Already agreed at a money action during setup (the gate): the step is done, nothing to raise.
    if (owed && address && hasAcknowledgedTerms(address)) {
      completeSetupStep(address, "terms");
      return;
    }
    if (showing) {
      raised.current = false;
      return;
    }
    if (!owed || !onTabs || raised.current) return;
    raised.current = true;
    router.push(`${ROUTES.termsSheet}?setup=1` as Href);
  }, [owed, onTabs, showing, address]);
  return null;
}
