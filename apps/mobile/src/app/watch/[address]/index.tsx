import { useLocalSearchParams } from "expo-router";
import { TraderProfile } from "~/features/social/TraderProfile";
import { profileLookup, WatchEntry } from "~/features/social/WatchEntry";

/**
 * `/watch/[address]` — a trader's public profile (J8, S1b.14; F91 watch mode, D-031): the segment is an address or a
 * @handle, resolved on the active network. Read-only for everyone, account or not. A segment that is neither opens
 * the entry form.
 */
export default function WatchScreen() {
  const params = useLocalSearchParams<{ address: string }>();
  const raw = typeof params.address === "string" ? params.address : "";
  const lookup = profileLookup(raw);
  if (!lookup) return <WatchEntry initial={raw} />;
  return <TraderProfile lookup={lookup} />;
}
