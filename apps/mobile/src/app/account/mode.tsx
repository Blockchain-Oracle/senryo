import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { NetworkPicker } from "~/features/network/NetworkPicker";

/** F06 practice ↔ real (S8.22): the same selector as the top-strip mode capsule. */
export default function ModeScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Practice or real" }} />
      <NetworkPicker />
    </Screen>
  );
}
