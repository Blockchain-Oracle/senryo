import { Stack } from "expo-router";
import { FONT, useTheme } from "~/theme";
import { TopStrip } from "./TopStrip";

/**
 * Each tab is its own stack: the tab root shows the D2 top strip as a solid header; pushed screens get a plain D2
 * header with a minimal back button (edge swipe / system back), staying inside the tab.
 */
export function TabStack() {
  const { color } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.ground },
        headerTintColor: color.ink,
        headerTitleStyle: { fontFamily: FONT.sansStrong },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: color.ground },
      }}
    >
      <Stack.Screen name="index" options={{ header: () => <TopStrip /> }} />
    </Stack>
  );
}
