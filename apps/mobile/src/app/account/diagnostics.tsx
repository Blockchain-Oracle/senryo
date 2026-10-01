import { Stack } from "expo-router";
import { Text } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { DiagnosticsPanel } from "~/features/auth/DiagnosticsPanel";
import { TYPE, useTheme } from "~/theme";

/**
 * Diagnostics (S6.10; J9 moved it off the You tab to a row in About): what this phone measured about its own passkey
 * prompts and timings. Kept on the device; cleared from here or by "Delete my data".
 */
export default function Diagnostics() {
  const { color } = useTheme();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Diagnostics" }} />
      <Text style={[TYPE.body, { color: color.text2 }]}>
        How many prompts each passkey step took on this phone, and how long it ran. Nothing secret is recorded; the log
        is kept on this phone.
      </Text>
      <DiagnosticsPanel />
    </Screen>
  );
}
