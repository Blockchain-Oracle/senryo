/**
 * Moving through the first-run setup (A2): finishing or skipping a step records it for this account and pushes the
 * next page; terms and Face ID open over Home. Each account retains its recorded setup order. Each step calls `next()` and nothing else knows the order.
 */
import type { Address } from "@senryo/account";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { raiseSetupTerms } from "~/features/legal/TermsHost";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, setupRoute } from "~/lib/constants/routes";
import { completeSetupStep, type SetupStep } from "./progress";
import { OVER_HOME } from "./setup-order";

/** After a step completes: its successor's page, or Home (where the over-Home steps appear, and setup ends). */
export function goToSetupStep(following: SetupStep | undefined, address?: Address): void {
  if (following && !OVER_HOME.includes(following)) {
    router.push(setupRoute(following) as Href);
    return;
  }
  router.replace(ROUTES.home);
  if (following === "terms" && address) raiseSetupTerms(address);
}

export function useSetupNav(step: SetupStep) {
  const address = useAccount().hint?.address;
  const owner = useRef(address);
  owner.current = address;
  const advanced = useRef(false);
  useFocusEffect(
    useCallback(() => {
      advanced.current = false;
      return () => {
        advanced.current = true;
      };
    }, []),
  );
  const next = useCallback(() => {
    if (!address || owner.current !== address || advanced.current) return;
    advanced.current = true;
    goToSetupStep(completeSetupStep(address, step), address);
  }, [address, step]);
  const back = useCallback(() => router.back(), []);
  return { next, back, address };
}
