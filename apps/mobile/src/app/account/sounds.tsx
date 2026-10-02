import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { SoundPicker } from "~/features/sounds/SoundPicker";

/** Preferences → Sounds: choose each cue by ear (flow book G5). */
export default function Sounds() {
  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title: "Sounds" }} />
      <SoundPicker />
    </Screen>
  );
}
