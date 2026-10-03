"use client";

/**
 * The inbox's session (flow book G1; the phone's `useInbox`): every notifications route is a session route (SIWE) and
 * the bell polls — so the runner exists only while the trading session is unlocked (signing in to the api is then
 * silent). Opening the inbox or a badge refresh never raises the passkey; a locked account sees "Unlock" instead.
 */
import { engineMarket } from "@senryo/config";
import {
  notificationKeys,
  useMarkNotificationsRead,
  useNotifications,
  useQueryEnv,
  useUnreadCount,
} from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { known } from "@/components/ui/reading";
import { useAccount } from "@/lib/account/provider";
import { useSessionRunner } from "@/lib/account/use-session-runner";
import { positionHref, ROUTES, watchHref } from "@/lib/constants/routes";

export type InboxAccess = "loading" | "guest" | "locked" | "ready";

function useQuietSession() {
  const account = useAccount();
  const runner = useSessionRunner();
  const unlocked = account.snapshot.status === "unlocked";
  const access: InboxAccess =
    account.status === "loading" ? "loading" : !account.hint ? "guest" : unlocked ? "ready" : "locked";
  return { access, address: account.hint?.address, session: unlocked ? runner : undefined };
}

export function useInbox() {
  const env = useQueryEnv();
  const cache = useQueryClient();
  const { access, address, session } = useQuietSession();
  const list = useNotifications(env.chainId, address, session);
  const markRead = useMarkNotificationsRead(env.chainId, address, session);
  const retry = () =>
    address ? void cache.invalidateQueries({ queryKey: notificationKeys.list(env.chainId, address) }) : undefined;
  return { access, ...list, markRead, retry };
}

/** The bell's count (a number, never a dot); undefined when unknown or zero. */
export function useBellCount(): number | undefined {
  const env = useQueryEnv();
  const { address, session } = useQuietSession();
  const count = known(useUnreadCount(env.chainId, address, session)) ?? 0;
  return count > 0 ? count : undefined;
}

const SCHEME = /^senryo:\/\//;

/**
 * The web page a notification's link opens (flow book G2 link table): `senryo://markets/XAU` → the market,
 * `senryo://positions/0` → that position, `senryo://watch/<address>` → the profile, `activity` / `card` / `pool` → those
 * pages; anything else opens Home. The link's `chainId` is kept for a profile.
 */
export function webPathOf(url: string | null): string {
  if (!url) return ROUTES.home;
  const parsed = new URL(url.replace(SCHEME, "https://senryo.local/"));
  const [head, arg] = parsed.pathname.split("/").filter(Boolean);
  const chainId = Number(parsed.searchParams.get("chainId") ?? Number.NaN);
  switch (head) {
    case "markets":
    case "trade":
      return arg ? ROUTES.trade(arg.toUpperCase()) : ROUTES.markets;
    case "positions": {
      const meta = arg === undefined ? undefined : engineMarket(Number(arg));
      return meta ? positionHref(meta.symbol) : ROUTES.home;
    }
    case "watch":
      return arg ? watchHref(arg, Number.isNaN(chainId) ? undefined : chainId) : ROUTES.watch;
    case "activity":
      return ROUTES.activity;
    case "card":
      return ROUTES.card;
    case "lp":
      return ROUTES.pool;
    default:
      return ROUTES.home;
  }
}
