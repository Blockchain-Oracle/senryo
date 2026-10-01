import { useLocalSearchParams } from "expo-router";
import { TokenDetail } from "~/features/tokens/TokenDetail";

/** `/markets/tokens/[token]` — a spot token's page on the Markets stack (J11). */
export default function TokenPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <TokenDetail symbol={token ?? ""} />;
}
