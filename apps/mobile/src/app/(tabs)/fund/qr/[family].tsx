import { Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { ShellScreen } from "~/components/shell/ShellScreen";
import { MonadInbox } from "~/features/fund/MonadInbox";

/** Deposit address per family: the Monad inbox is live (S8.24); the intent families arrive with Aurora (S9). */
export default function DepositAddressScreen() {
  const { family } = useLocalSearchParams<{ family: string }>();
  if (family === "monad") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Deposit from Monad" }} />
        <MonadInbox />
      </Screen>
    );
  }
  return (
    <ShellScreen
      title="Deposit address"
      why="Deposits from other chains arrive with intents"
      detail="Each account gets its own persistent address with the accepted assets, minimum, fee and ETA listed above the QR."
    />
  );
}
