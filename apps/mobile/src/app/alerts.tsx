import { NotificationsScreen } from "~/features/notifications/NotificationsScreen";

/** `/alerts` — kept for links and the market page's "All alerts": the inbox on its Alerts tab (C9). */
export default function Alerts() {
  return <NotificationsScreen initialTab="alerts" />;
}
