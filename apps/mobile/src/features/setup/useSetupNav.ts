/**
 * Moving through the first-run setup (A2): finishing or skipping a step records it for this account and pushes the
 * next page; terms and Face ID open over Home. Each account retains its recorded setup order. Each step calls `next()` and nothing else knows the order.
 */
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { useAccount } from "~/lib/account/provider";
import { ROUTES, setupRoute } from "~/lib/constants/routes";
import { completeSetupStep, type SetupStep } from "./progress";

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
    const following = address ? completeSetupStep(address, step) : undefined;
    if (following && following !== "terms" && following !== "face-id") router.push(setupRoute(following) as Href);
    else router.replace(ROUTES.home);
  }, [address, step]);
  const back = useCallback(() => router.back(), []);
  return { next, back, address };
}
