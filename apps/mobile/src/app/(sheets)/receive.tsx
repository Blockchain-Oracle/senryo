import { router } from "expo-router";
import { useState } from "react";
import { Button } from "~/components/kit/Button";
import { Segmented } from "~/components/kit/Segmented";
import { useSheetClose } from "~/components/sheet/Sheet";
import { SheetRoute } from "~/components/sheet/SheetRoute";
import { MonadInbox } from "~/features/fund/MonadInbox";
import { WalletReceive } from "~/features/fund/WalletReceive";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";

const DESTINATIONS = [
  { value: "wallet", label: "Wallet" },
  { value: "trading", label: "Trading account" },
] as const;
export default function ReceiveSheet() {
  const network = useNetwork();
  const [destination, setDestination] = useState<"wallet" | "trading">(
    network.key === "mainnet" ? "wallet" : "trading",
  );
  return (
    <SheetRoute title="Receive">
      <Segmented options={DESTINATIONS} value={destination} onChange={setDestination} label="Receive into" />
      {destination === "wallet" ? <WalletReceive /> : <MonadInbox compact />}
      {destination === "wallet" ? <Transfer /> : null}
    </SheetRoute>
  );
}
function Transfer() {
  const close = useSheetClose();
  return (
    <Button
      label="Move wallet funds into trading"
      variant="ghost"
      onPress={() => close(() => router.push(ROUTES.fundWallet))}
    />
  );
}
