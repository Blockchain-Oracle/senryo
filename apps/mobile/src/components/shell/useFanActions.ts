import { router } from "expo-router";
import { useCallback } from "react";
import { useTermsGate } from "~/lib/account/terms-gate";
import { ROUTES } from "~/lib/constants/routes";
import type { FanAction } from "./constants";

/**
 * Where each fan action goes (direction §5; FT055/FT057/FT060; Codex S1b.7 consult #8): Send → the send surface
 * (reserved until J8 builds the recipient flow), Receive → the compact QR sheet on the account's Monad deposit inbox,
 * Add money → the add-money hub, Swap → the existing swap.
 * Each opens over the page under the fan, so dismissing it restores that page (FT061).
 */
export function useFanActions(): (action: FanAction) => void {
  const gate = useTermsGate();
  return useCallback(
    (action: FanAction) => {
      // Every money action passes the terms gate first (flow book A11); a guest gets the account sheet, which
      // resumes the action once the account exists.
      switch (action) {
        case "send":
          gate(() => router.push(ROUTES.withdrawSend), { verb: "send", next: ROUTES.withdrawSend });
          return;
        case "receive":
          gate(() => router.push(ROUTES.receive), { verb: "add money", next: ROUTES.receive });
          return;
        case "addMoney":
          gate(() => router.push(ROUTES.addMoney), { verb: "add money", next: ROUTES.addMoney });
          return;
        case "swap":
          gate(() => router.push(ROUTES.fundSwap), { verb: "trade", next: ROUTES.fundSwap });
          return;
      }
    },
    [gate],
  );
}
