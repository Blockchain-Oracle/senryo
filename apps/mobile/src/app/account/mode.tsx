import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { NetworkPicker } from "~/features/network/NetworkPicker";

/** A8 Mode, from Settings: the same two rows as the mode pill's sheet. */
export default function ModeScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Mode" }} />
      <NetworkPicker />
    </Screen>
  );
}
