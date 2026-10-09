import { Stack } from "expo-router";
import { EarnScreen } from "~/features/earn/EarnScreen";

/** Earn: supply the pool that takes the other side; withdraw at the hour (S7.6, D-287). */
export default function Earn() {
  return (
    <>
      <Stack.Screen options={{ title: "Earn", headerShown: true, headerBackTitle: "Back" }} />
      <EarnScreen />
    </>
  );
}
