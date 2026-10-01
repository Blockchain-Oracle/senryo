import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { QuietState } from "~/features/profile/QuietState";

/**
 * Notification settings are not built yet, and the page says exactly that: one quiet line, no switches that do
 * nothing. When they land (direction: trading / card / deposit / social preferences with the OS permission state),
 * they replace this line.
 */
export default function NotificationsScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Notifications" }} />
      <QuietState
        line="Notifications arrive with a later build"
        detail="Fills, liquidation warnings, deposits and card activity will each have a switch here."
      />
    </Screen>
  );
}
