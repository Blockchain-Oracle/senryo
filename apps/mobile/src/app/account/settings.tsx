import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { YouSections } from "~/features/profile/YouSections";
import { useAccount } from "~/lib/account/provider";
/** Browsing preferences never unlocks an account. Sensitive changes retain their own authentication. */
export default function Settings() {
  const account = useAccount();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Settings" }} />
      <YouSections guest={!account.hint} />
    </Screen>
  );
}
