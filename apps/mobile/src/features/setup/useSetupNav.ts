/**
 * Moving through the first-run setup (A2): finishing or skipping a step records it for this account and pushes the
 * next page; the terms come last as a sheet over Home (`TermsHost` raises it when Home shows), and after them setup
 * is finished. Each step calls `next()` and nothing else knows the order.
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
    if (following && following !== "terms") router.push(setupRoute(following) as Href);
    else router.replace(ROUTES.home);
  }, [address, step]);
  const back = useCallback(() => router.back(), []);
  return { next, back, address };
}
