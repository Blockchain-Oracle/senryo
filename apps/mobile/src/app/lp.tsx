import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { LpScreen } from "~/features/lp/LpScreen";

export default function LiquidityPoolScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Liquidity pool" }} />
      <LpScreen />
    </Screen>
  );
}
