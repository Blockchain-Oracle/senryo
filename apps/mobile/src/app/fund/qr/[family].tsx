import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { ShellScreen } from "~/components/shell/ShellScreen";
import { MonadInbox } from "~/features/fund/MonadInbox";
import { WalletReceive } from "~/features/fund/WalletReceive";
import { useNetwork } from "~/lib/network";

const DESTINATIONS = [
  { value: "wallet", label: "Wallet" },
  { value: "trading", label: "Trading account" },
] as const;

/** Deposit address per family: the Monad inbox is live (S8.24); the intent families arrive with Aurora (S9). */
export default function DepositAddressScreen() {
  const { family } = useLocalSearchParams<{ family: string }>();
  const network = useNetwork();
  const [destination, setDestination] = useState<"wallet" | "trading">(
    network.key === "mainnet" ? "wallet" : "trading",
  );
  if (family === "monad") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Receive on Monad" }} />
        <Segmented options={DESTINATIONS} value={destination} onChange={setDestination} label="Receive into" />
        {destination === "wallet" ? <WalletReceive /> : <MonadInbox />}
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
