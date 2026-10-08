/** Terms open over Home before Face ID for new accounts; legacy accounts retain their remaining order.
 * A previous money-action acknowledgement completes the same legal version without asking twice.
 */
import type { Address } from "@senryo/account";
import { type Href, router, useSegments } from "expo-router";
import { useEffect } from "react";
import { useMMKVString } from "react-native-mmkv";
import { completeSetupStep, pendingSetupStep } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { hasAcknowledgedTerms } from "./acknowledged";

/** The account the setup's terms sheet is up (or on its way) for: one sheet, whoever raises it. */
let raisedFor: string | undefined;

/**
 * Opens the setup's terms sheet over Home, once. The handle step calls it in the same tick as its replace to Home, so
 * the stack lands on [Home, terms] in one change (raising it from an effect after the replace lost the push mid-way);
 * TermsHost calls it on a resumed setup and again if the sheet is dismissed without agreeing.
 */
export function raiseSetupTerms(address: Address) {
  if (raisedFor === address) return;
  raisedFor = address;
  router.push(`${ROUTES.termsSheet}?setup=1` as Href);
}

export function TermsHost() {
  const account = useAccount();
  useMMKVString(STORAGE_KEYS.setup, storage);
  const segments = useSegments() as string[];
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
      raisedFor = undefined;
      return;
    }
    if (owed && onTabs && address) raiseSetupTerms(address);
  }, [owed, onTabs, showing, address]);
  return null;
}
