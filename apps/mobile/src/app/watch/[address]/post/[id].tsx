import { Stack, useLocalSearchParams } from "expo-router";
import { Thread } from "~/features/social/Thread";

/**
 * `/watch/[address]/post/[id]` — a thesis with its replies opened from its author's profile (J8, S1b.14). The same
 * page as `/social/post/[id]`, kept over the profile so back returns there; outside the shell there is no dock.
 */
export default function TraderPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: "Post" }} />
      <Thread id={id} />
    </>
  );
}
