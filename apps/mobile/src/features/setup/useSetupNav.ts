/**
 * Moving through the first-run setup (J1): finishing or skipping a step records it for this account and pushes the
 * next one; after the last it lands on Home. Each step calls `next()` and nothing else knows the order.
 */
import { type Href, router } from "expo-router";
import { useCallback } from "react";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, setupRoute } from "~/lib/constants/routes";
import { completeSetupStep, type SetupStep } from "./progress";

export function useSetupNav(step: SetupStep) {
  const address = useAccount().hint?.address;
  const next = useCallback(() => {
    const following = address ? completeSetupStep(address, step) : undefined;
    if (following) router.push(setupRoute(following) as Href);
    else router.replace(ROUTES.home);
  }, [address, step]);
  const back = useCallback(() => router.back(), []);
  return { next, back, address };
}
