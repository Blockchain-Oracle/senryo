import { useLiveSync } from "@senryo/query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { apiSessionScope, onApiSession } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { appLive } from "~/lib/live";
import { useNetwork } from "~/lib/network";

/**
 * Keeps the live stream in step with the app: background closes it after a minute, foreground reopens it; the user's
 * topic follows the API session for the signed-in account on the active network; their events keep queries true.
 */
export function LiveHost() {
  const live = appLive();
  const address = useAccount().hint?.address;
  const chainId = useNetwork().chainId;
  useLiveSync(live, address);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => live.stream.setVisible(state === "active"));
    return () => sub.remove();
  }, [live]);

  useEffect(() => {
    const follow = (scope = apiSessionScope()) =>
      live.setUser(scope && address && scope.address === address && scope.chainId === chainId ? address : null);
    follow();
    return onApiSession(follow);
  }, [live, address, chainId]);

  return null;
}
