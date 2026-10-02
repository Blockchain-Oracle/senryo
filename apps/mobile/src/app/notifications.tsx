import { useLocalSearchParams } from "expo-router";
import { NotificationsScreen } from "~/features/notifications/NotificationsScreen";

/** `/notifications` — the inbox (G1); `?tab=alerts` opens the price alerts (C9). */
export default function Notifications() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return <NotificationsScreen initialTab={tab === "alerts" ? "alerts" : "all"} />;
}
