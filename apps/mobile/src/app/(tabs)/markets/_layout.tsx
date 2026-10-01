import { Stack } from "expo-router";
import { TabStack } from "~/components/shell/TabStack";

/** Sheets on this stack are transparent modals that draw their own scrim and panel (the one-sheet pattern). */
const sheet = {
  presentation: "transparentModal",
  animation: "none",
  headerShown: false,
  contentStyle: { backgroundColor: "transparent" },
} as const;

/**
 * The Markets stack: list → search (page push, F31) and market detail (page push, F32) → the order ticket, a
 * full-height transaction sheet that draws its own scrim over market detail (transparent modal; the dock hides while
 * it is focused), and the price-alert editor, a compact sheet over it. Search and market detail draw their own bar
 * (the market's identity sits in it), so the native header is off for them. Dismissing the ticket restores market
 * detail with the draft kept per (mode, market) — FT112. Spot tokens (J11) follow the same shape: the token's page
 * (page push) and its swap ticket (transaction sheet).
 */
export default function Layout() {
  return (
    <TabStack>
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="[market]/index" options={{ headerShown: false }} />
      <Stack.Screen name="[market]/ticket" options={sheet} />
      <Stack.Screen name="[market]/alert" options={sheet} />
      <Stack.Screen name="tokens/[token]/index" options={{ headerShown: false }} />
      <Stack.Screen name="discover/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="tokens/[token]/trade" options={sheet} />
    </TabStack>
  );
}

/** Deep links into a pushed page keep the tab root underneath, so back always has somewhere to go. */
export const unstable_settings = { initialRouteName: "index" };
