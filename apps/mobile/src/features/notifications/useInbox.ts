/**
 * The inbox's session (G1): every notifications route is a session route, and the bell polls — so the runner exists
 * only while the trading session is unlocked (signing in to the api is then silent). Opening the inbox or a badge
 * refresh never raises Face ID by itself; a locked account sees "Unlock" instead.
 */
import { notificationKeys, useMarkNotificationsRead, useNotifications, useUnreadCount } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "~/lib/account/provider";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { useNetwork } from "~/lib/network";

export type InboxAccess = "loading" | "guest" | "locked" | "ready";

function useQuietSession() {
  const account = useAccount();
  const runner = useSessionRunner();
  const unlocked = account.snapshot.status === "unlocked";
  const access: InboxAccess = !account.ready ? "loading" : !account.hint ? "guest" : unlocked ? "ready" : "locked";
  return { access, address: account.hint?.address, session: unlocked ? runner : undefined };
}

export function useInbox() {
  const network = useNetwork();
  const cache = useQueryClient();
  const { access, address, session } = useQuietSession();
  const list = useNotifications(network.chainId, address, session);
  const markRead = useMarkNotificationsRead(network.chainId, address, session);
  const retry = () =>
    address ? void cache.invalidateQueries({ queryKey: notificationKeys.list(network.chainId, address) }) : undefined;
  return { access, ...list, markRead, retry };
}

/** The bell's count (a number, never a dot); undefined when unknown or zero. */
export function useBellCount(): number | undefined {
  const network = useNetwork();
  const { access, address, session } = useQuietSession();
  const unread = useUnreadCount(network.chainId, address, session);
  const count = unread.status === "fresh" || unread.status === "stale" ? unread.value : 0;
  return access === "ready" && count > 0 ? count : undefined;
}
