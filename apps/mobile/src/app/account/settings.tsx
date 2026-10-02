import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { SettingsList } from "~/features/profile/SettingsList";

/** Settings (A10), from the profile's gear. Browsing never unlocks the account; sensitive changes keep their step-up. */
export default function Settings() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Settings" }} />
      <SettingsList />
    </Screen>
  );
}
