import { isDeployed } from "@senryo/chain";
import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { WalletFunding } from "~/features/fund/WalletFunding";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { useNetwork } from "~/lib/network";
export default function WalletFundingScreen() {
  const network = useNetwork();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Move into trading" }} />
      {isDeployed(network.chainId, "SenryoCore") ? <WalletFunding /> : <PrelaunchMainnet surface="portfolio" />}
    </Screen>
  );
}
