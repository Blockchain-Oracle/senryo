import { Stack } from "expo-router";
import { TabStack } from "~/components/shell/TabStack";

/**
 * The Social stack: the tab root (the feed) → a post with its replies, People (leaderboard and friends) and Search
 * (page pushes). Search draws its own bar.
 */
export default function Layout() {
  return (
    <TabStack>
      <Stack.Screen name="post/[id]" options={{ title: "Post" }} />
      <Stack.Screen name="people" options={{ title: "People" }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
    </TabStack>
  );
}

/** Deep links into a pushed page keep the tab root underneath, so back always has somewhere to go. */
export const unstable_settings = { initialRouteName: "index" };
