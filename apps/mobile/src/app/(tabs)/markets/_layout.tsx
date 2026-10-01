import { Stack } from "expo-router";
import { TabStack } from "~/components/shell/TabStack";

/**
 * The Markets stack: list → market detail (page push) → the order ticket, a full-height transaction sheet that draws
 * its own scrim over market detail (transparent modal; the dock hides while it is focused). Dismissing it restores
 * market detail with the draft kept per (mode, market) — FT112.
 */
export default function Layout() {
  return (
    <TabStack>
      <Stack.Screen name="[market]/index" options={{ title: "" }} />
      <Stack.Screen
        name="[market]/ticket"
        options={{
          presentation: "transparentModal",
          animation: "none",
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </TabStack>
  );
}

/** Deep links into a pushed page keep the tab root underneath, so back always has somewhere to go. */
export const unstable_settings = { initialRouteName: "index" };
