import { Stack } from "expo-router";
import { LuckyScreen } from "~/features/games/LuckyScreen";

/** Lucky: a sealed draw picks a market, a side and a reach; one real call. */
export default function Lucky() {
  return (
    <>
      <Stack.Screen options={{ title: "Lucky", headerShown: true, headerBackTitle: "Back" }} />
      <LuckyScreen />
    </>
  );
}
