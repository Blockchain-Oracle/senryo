import { useLocalSearchParams } from "expo-router";
import { DiscoveryDetail } from "~/features/markets/DiscoveryDetail";

/** `/markets/discover/[id]` — a read-only instrument's page on the Markets stack (review S03). */
export default function DiscoverPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DiscoveryDetail id={decodeURIComponent(id ?? "")} />;
}
