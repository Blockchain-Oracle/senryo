import { Stack, useLocalSearchParams } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { BridgeIn } from "~/features/fund/BridgeIn";
import { isBridgeAsset } from "~/features/fund/bridge-assets";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";

/** `/fund/bridge?asset=USDC&chain=8453` — deposit from another chain: amount, live quote, the way it starts (B4). */
export default function BridgeInScreen() {
  const { asset, chain } = useLocalSearchParams<{ asset?: string; chain?: string }>();
  const owner = useAccount().hint?.address;
  const sourceChain = useNetwork().chainId;
  const chainId = Number.parseInt(chain ?? "", 10);
  return (
    <Screen>
      <Stack.Screen options={{ title: isBridgeAsset(asset) ? `Deposit ${asset}` : "Deposit" }} />
      {isBridgeAsset(asset) && !Number.isNaN(chainId) ? (
        <BridgeIn key={`${owner}:${sourceChain}:${asset}:${chainId}`} asset={asset} chainId={chainId} />
      ) : (
        <QuietLine>No route for this link</QuietLine>
      )}
    </Screen>
  );
}
