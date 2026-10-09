import { Stack } from "expo-router";
import { ParlayScreen } from "~/features/parlay/ParlayScreen";

/** Parlay: 2–4 calls that must all come true; the odds multiply (S8.5, D-293). */
export default function Parlay() {
  return (
    <>
      <Stack.Screen options={{ title: "Parlay", headerShown: true, headerBackTitle: "Back" }} />
      <ParlayScreen />
    </>
  );
}
