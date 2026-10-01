import { router } from "expo-router";
import { useCallback } from "react";
import { ROUTES } from "~/lib/constants/routes";
import type { FanAction } from "./constants";

/**
 * Where each fan action goes (direction §5; FT055/FT057/FT060; Codex S1b.7 consult #8): Send → the send surface
 * (reserved until J8 builds the recipient flow), Receive → the compact QR sheet on the account's Monad deposit inbox,
 * Add money → the add-money hub, Swap → the existing swap.
 * Each opens over the page under the fan, so dismissing it restores that page (FT061).
 */
export function useFanActions(): (action: FanAction) => void {
  return useCallback((action: FanAction) => {
    switch (action) {
      case "send":
        router.push(ROUTES.withdrawSend);
        return;
      case "receive":
        router.push(ROUTES.receive);
        return;
      case "addMoney":
        router.push(ROUTES.addMoney);
        return;
      case "swap":
        router.push(ROUTES.fundSwap);
        return;
    }
  }, []);
}
