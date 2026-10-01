import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { IdentityPanel } from "~/features/auth/IdentityPanel";

/** Account identity (J9): the address with Copy and the watch link, its two networks, and the passkey behind it. */
export default function AccountIdentity() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Account identity" }} />
      <IdentityPanel />
    </Screen>
  );
}
