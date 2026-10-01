import { useLocalSearchParams } from "expo-router";
import { TicketScreen } from "~/features/trade/TicketScreen";
import { DEFAULT_MARKET } from "~/lib/constants/routes";

/** `/markets/[market]/ticket?side=long|short` — the order ticket over market detail (J4, C39–C43). */
export default function Ticket() {
  const { market, side } = useLocalSearchParams<{ market: string; side?: string }>();
  return (
    <TicketScreen
      marketId={(market ?? DEFAULT_MARKET).toUpperCase()}
      side={side === "short" ? "short" : side === "long" ? "long" : undefined}
    />
  );
}
