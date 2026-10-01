import { useLocalSearchParams } from "expo-router";
import { TokenTicket } from "~/features/tokens/TokenTicket";

/** `/markets/tokens/[token]/trade?side=buy|sell` — the swap ticket over the token's page (J11, C37). */
export default function TokenTrade() {
  const { token, side } = useLocalSearchParams<{ token: string; side?: string }>();
  return <TokenTicket symbol={token ?? ""} side={side === "sell" ? "sell" : "buy"} />;
}
