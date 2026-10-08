import { Stack } from "expo-router";
import { WalletScreen } from "~/features/wallet/WalletScreen";

/** The Wallet: Practice dollars, Receive, Withdraw; Real methods locked until Real opens (S5.12). */
export default function Wallet() {
  return (
    <>
      <Stack.Screen options={{ title: "Wallet", headerShown: true, headerBackTitle: "Back" }} />
      <WalletScreen />
    </>
  );
}
