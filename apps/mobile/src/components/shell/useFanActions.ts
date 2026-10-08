import { router } from "expo-router";
import { useCallback } from "react";
import { useTermsGate } from "~/lib/account/terms-gate";
import { ROUTES } from "~/lib/constants/routes";
import type { FanAction } from "./constants";

/**
 * Where each fan action goes (flow book B3): Receive → the wallet's one QR on Monad (D-241). Add money and Withdraw
 * arrive with S5. Each opens over the page under the fan, so dismissing it restores that page (FT061).
 */
export function useFanActions(): (action: FanAction) => void {
  const gate = useTermsGate();
  return useCallback(
    (action: FanAction) => {
      // Every money action passes the terms gate first (flow book A11); a guest gets the account sheet, which
      // resumes the action once the account exists.
      switch (action) {
        case "receive":
          gate(() => router.push(ROUTES.receive), { verb: "add money", next: ROUTES.receive });
          return;
      }
    },
    [gate],
  );
}
