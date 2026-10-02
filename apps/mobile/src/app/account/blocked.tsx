import { Stack } from "expo-router";
import { Screen } from "~/components/kit/Screen";
import { BlockedMuted } from "~/features/social/BlockedMuted";

/** `/account/blocked` — Settings → Blocked & muted (F5, F-D7): Muted · Blocked, each undone from its row. */
export default function BlockedMutedPage() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Blocked & muted" }} />
      <BlockedMuted />
    </Screen>
  );
}
