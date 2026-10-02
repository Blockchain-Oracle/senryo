import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { IdentityPanel } from "~/features/auth/IdentityPanel";

/** Wallet & address (A10): the Receive grammar for the account address, its two networks, and the passkey behind it. */
export default function AccountIdentity() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Wallet & address" }} />
      <IdentityPanel />
    </Screen>
  );
}
