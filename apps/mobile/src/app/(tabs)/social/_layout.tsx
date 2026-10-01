import { Stack } from "expo-router";
import { TabStack } from "~/components/shell/TabStack";

/** The Social stack: the tab root (feed, people, leaderboard) → a thesis with its replies (page push). */
export default function Layout() {
  return (
    <TabStack>
      <Stack.Screen name="post/[id]" options={{ title: "Thesis" }} />
    </TabStack>
  );
}

/** Deep links into a pushed page keep the tab root underneath, so back always has somewhere to go. */
export const unstable_settings = { initialRouteName: "index" };
