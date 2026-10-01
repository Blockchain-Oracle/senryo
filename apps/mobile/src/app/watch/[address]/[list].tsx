import type { Address } from "@senryo/account";
import { useLocalSearchParams } from "expo-router";
import { ShellScreen } from "~/components/shell/ShellScreen";
import { type FollowDirection, FollowListScreen } from "~/features/social/FollowListScreen";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const LISTS: readonly FollowDirection[] = ["followers", "following"];

/** `/watch/[address]/followers` and `/watch/[address]/following` — opened from a profile's counts (J8, S1b.14). */
export default function FollowListRoute() {
  const params = useLocalSearchParams<{ address: string; list: string }>();
  const list = LISTS.find((l) => l === params.list);
  if (!list || !params.address || !ADDRESS.test(params.address)) {
    return (
      <ShellScreen
        title="Not found"
        why="Nothing to list here"
        detail="This link doesn’t name an account and one of its lists."
      />
    );
  }
  return <FollowListScreen address={params.address as Address} direction={list} />;
}
