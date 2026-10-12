import { Stack } from "expo-router";
import { WarmUpScreen } from "~/features/games/WarmUpScreen";

/** Warm-up: five live cards against a coin (R7.5). */
export default function WarmUp() {
  return (
    <>
      <Stack.Screen options={{ title: "Warm-up", headerShown: true, headerBackTitle: "Back" }} />
      <WarmUpScreen />
    </>
  );
}
