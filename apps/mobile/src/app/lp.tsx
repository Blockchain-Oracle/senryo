import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { LpScreen } from "~/features/lp/LpScreen";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { useReadOnlyNetwork } from "~/lib/network";

export default function LiquidityPoolScreen() {
  const readOnly = useReadOnlyNetwork();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Liquidity pool" }} />
      {readOnly ? <PrelaunchMainnet surface="lp" /> : <LpScreen />}
    </Screen>
  );
}
