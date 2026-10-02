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
export function DeferredLinkHost() {
  const account = useAccount();
  const segments = useSegments();
  const prompted = useRef<string | undefined>(undefined);
  const [pending, setPending] = useMMKVString(PENDING_LINK, storage);
  useEffect(() => {
    if (
      !pending ||
      !account.ready ||
      !storage.getBoolean(STORAGE_KEYS.welcomed) ||
      segments.some((segment: string) => segment === "welcome" || segment === "setup") ||
      pendingSetupStep(account.hint?.address)
    )
      return;
    if (incomingNeedsAccount(pending) && !account.hint) {
      if (prompted.current !== pending) {
        prompted.current = pending;
        router.push(ROUTES.accountRequired);
      }
      return;
    }
    const target = linkTarget(pending, activeNetwork().chainId);
    setPending(undefined);
    router.push(target as Href);
  }, [pending, setPending, segments, account.ready, account.hint?.address]);
  return null;
}
