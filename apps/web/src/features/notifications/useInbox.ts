"use client";
/**
 * The web inbox's session (R5.22; the phone's `useInbox`): every notifications route is a session route, so the inbox
 * reads with the passkey account's api session while it is unlocked, or the Practice guest's key session (never a
 * prompt); the bell polls only then. A locked account sees Unlock, which signs in once on that deliberate tap.
 */
import { useGuestKey } from "@senryo/calls/react";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import {
  notificationKeys,
  type SessionRunner,
  useMarkNotificationsRead,
  useNotifications,
  useQueryEnv,
  useUnreadCount,
} from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { guestSession } from "@/lib/account/guest";
import { useAccount } from "@/lib/account/provider";
import { useSessionRunner } from "@/lib/account/use-session-runner";

export type InboxAccess = "loading" | "none" | "locked" | "ready";

interface QuietSession {
  access: InboxAccess;
  address: `0x${string}` | undefined;
  session: SessionRunner | undefined;
  unlock: (() => Promise<void>) | undefined;
}

function useQuietSession(): QuietSession {
  const account = useAccount();
  const runner = useSessionRunner();
  const key = useGuestKey();
  const { chainId } = useQueryEnv();
  const guest = useMemo(() => (key ? guestSession(key) : undefined), [key]);
  if (account.status === "loading")
    return { access: "loading", address: undefined, session: undefined, unlock: undefined };
  if (account.hint) {
    const unlocked = account.snapshot.status === "unlocked";
    return {
      access: unlocked ? "ready" : "locked",
      address: account.hint.address,
      session: unlocked ? runner : undefined,
      unlock: runner ? () => runner(async () => undefined) : undefined,
    };
  }
  if (chainId === TESTNET_CHAIN_ID && key && guest)
    return { access: "ready", address: key.address, session: guest, unlock: undefined };
  return { access: "none", address: undefined, session: undefined, unlock: undefined };
}

export function useInbox() {
  const { chainId } = useQueryEnv();
  const cache = useQueryClient();
  const { access, address, session, unlock } = useQuietSession();
  const list = useNotifications(chainId, address, session);
  const markRead = useMarkNotificationsRead(chainId, address, session);
  const retry = () =>
    address ? void cache.invalidateQueries({ queryKey: notificationKeys.list(chainId, address) }) : undefined;
  return { access, unlock, ...list, markRead, retry };
}

/** The bell's count (a number, never a dot); undefined when unknown or zero. */
export function useBellCount(): number | undefined {
  const { chainId } = useQueryEnv();
  const { access, address, session } = useQuietSession();
  const unread = useUnreadCount(chainId, address, session);
  const count = unread.status === "fresh" || unread.status === "stale" ? unread.value : 0;
  return access === "ready" && count > 0 ? count : undefined;
}
