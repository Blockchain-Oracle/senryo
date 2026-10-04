import { type Href, router, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { useMMKVString } from "react-native-mmkv";
import { pendingSetupStep } from "~/features/setup/progress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { linkTarget } from "~/lib/deep-link";
import { incomingNeedsAccount, PENDING_LINK } from "~/lib/incoming-link";
import { activeNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** Screens a deferred link never opens over: welcome, first-run setup and the account sheet it may have raised. */
const WAIT_SEGMENTS = new Set(["welcome", "setup", "account-required"]);

/**
 * Deferred links: a link that arrived before welcome or account setup finished (`incomingLink`) waits in storage and
 * opens once both are done. A link that needs an account asks once: it leaves storage and waits in memory for this
 * session, so an account made or signed in from that sheet still continues to it, while a guest who keeps browsing is
 * not asked again on every launch. It opens only once the account sheet has gone, never pushed under a closing sheet.
 */
export function DeferredLinkHost() {
  const account = useAccount();
  const segments = useSegments();
  const asked = useRef<string | undefined>(undefined);
  const [pending, setPending] = useMMKVString(PENDING_LINK, storage);
  const address = account.hint?.address;
  useEffect(() => {
    const link = pending ?? (address ? asked.current : undefined);
    if (
      !link ||
      !account.ready ||
      !storage.getBoolean(STORAGE_KEYS.welcomed) ||
      segments.some((segment: string) => WAIT_SEGMENTS.has(segment)) ||
      pendingSetupStep(address)
    )
      return;
    if (incomingNeedsAccount(link) && !address) {
      asked.current = link;
      setPending(undefined);
      router.push(ROUTES.accountRequired);
      return;
    }
    asked.current = undefined;
    setPending(undefined);
    router.push(linkTarget(link, activeNetwork().chainId) as Href);
  }, [pending, setPending, segments, account.ready, address]);
  return null;
}
