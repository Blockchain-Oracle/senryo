/**
 * Headless push host (S1b.13), mounted once beside the other hosts:
 * - shows a push that arrives while the app is open as a banner (the OS hides it by default);
 * - a tap — app open, in the background, or launched by it — opens the screen the push names, in the push's own mode:
 *   `data.url` with `data.chainId` goes through `linkTarget`, so a Mainnet push never opens silently in Practice;
 * - at each unlock, sends a registration this phone still owes (a failed primer, or a new account on this phone).
 */
import { type Href, router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useAccount } from "~/lib/account/provider";
import { incomingLink } from "~/lib/incoming-link";
import { notificationsModule } from "~/lib/native-modules";
import { type PushChannel, readPushPermission, registerPush, registrationOwed } from "./push";

type NotificationResponse = import("expo-notifications").NotificationResponse;

/** One Android channel per kind of news, named as You → Notifications names them. */
const ANDROID_CHANNELS: ReadonlyArray<{ id: PushChannel; name: string }> = [
  { id: "fills", name: "Trades and stop losses" },
  { id: "liquidation", name: "Liquidation warnings" },
  { id: "priceAlerts", name: "Price alerts" },
  { id: "deposits", name: "Deposits" },
  { id: "card", name: "Kinpaku card" },
];

/** Where a tapped push goes, or undefined when it names nowhere this app knows. */
export function tapTarget(data: Record<string, unknown> | undefined): string | undefined {
  const url = data?.url;
  if (typeof url !== "string" || url.length === 0) return undefined;
  const chainId = typeof data?.chainId === "number" ? data.chainId : Number(data?.chainId);
  // The keeper's links already name their network; `data.chainId` covers any that don't.
  const named = /[?&]chainId=/.test(url) || !Number.isFinite(chainId);
  const withChain = named ? url : `${url}${url.includes("?") ? "&" : "?"}chainId=${chainId}`;
  return incomingLink(withChain);
}

export function PushHost() {
  const account = useAccount();
  const unlockedAs = account.snapshot.status === "unlocked" ? account.snapshot.address : undefined;
  const client = account.client;
  const faceId = account.settings.faceId;

  useEffect(() => {
    const notifications = notificationsModule();
    if (!notifications) return;
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    // Android shows a push only on a channel the app created; the keeper sends each kind on its own (same ids).
    if (Platform.OS === "android") {
      for (const channel of ANDROID_CHANNELS) {
        void notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance:
            channel.id === "liquidation"
              ? notifications.AndroidImportance.HIGH
              : notifications.AndroidImportance.DEFAULT,
        });
      }
    }
    const handled = new Set<string>();
    const open = (response: NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      const target = tapTarget(response.notification.request.content.data);
      if (target) router.push(target as Href);
    };
    // A push that launched the app; the listener below covers taps while it runs.
    const launched = notifications.getLastNotificationResponse();
    if (launched) open(launched);
    const subscription = notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!unlockedAs || !client) return;
    const owed = registrationOwed(unlockedAs);
    if (!owed) return;
    void readPushPermission()
      .then((permission) => (permission === "granted" ? registerPush(client, unlockedAs, faceId, owed) : undefined))
      // Offline or the api refused: still owed, so the next unlock tries again.
      .catch(() => undefined);
  }, [unlockedAs, client, faceId]);

  return null;
}
