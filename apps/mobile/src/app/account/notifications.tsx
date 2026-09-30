import { ShellScreen } from "~/components/shell/ShellScreen";

export default function NotificationsScreen() {
  return (
    <ShellScreen
      title="Notifications"
      why="Notifications arrive later"
      detail="Channels for fills, liquidation warnings, deposits, card and price alerts."
    />
  );
}
