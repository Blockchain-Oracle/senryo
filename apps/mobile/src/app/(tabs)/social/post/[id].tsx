import { useLocalSearchParams } from "expo-router";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { Thread } from "~/features/social/Thread";

/**
 * `/social/post/[id]` — a thesis with its replies, pushed on the Social stack (J8, S1b.14). The reply composer owns
 * the bottom of the page, so the dock steps aside while this page is focused (as market detail does for Short / Long).
 */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useHideDockWhileFocused("social-thread");
  return <Thread id={id} />;
}
