import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { FONT, useTheme } from "~/theme";

/**
 * Each dock destination is its own Expo Router stack (D-193: stack and scroll survive tab switches). The tab root
 * draws its own collapsing header (`CollapsingScreen`); pages pushed on the tab get a plain Living Lacquer header with
 * a minimal back button (edge swipe / system back) and keep the dock under them.
 */
export function TabStack({ children }: { children?: ReactNode }) {
  const { color } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.ground },
        headerTintColor: color.ink,
        headerTitleStyle: { fontFamily: FONT.sansStrong },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        // The back button shows no text, but VoiceOver reads its title: never a route name like "(tabs)".
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: color.ground },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {children}
    </Stack>
  );
}
