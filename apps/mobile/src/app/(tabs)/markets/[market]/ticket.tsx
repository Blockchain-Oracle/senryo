import { useLocalSearchParams } from "expo-router";
import { TicketScreen } from "~/features/trade/TicketScreen";
import { DEFAULT_MARKET } from "~/lib/constants/routes";

/**
 * `/markets/[market]/ticket?side=long|short&leverage=5` — the order ticket over market detail (flow book C3). "Trade
 * this" (C11) passes the source's leverage when it knows it; the ticket clamps it to the market's max. The amount is
 * never prefilled.
 */
export default function Ticket() {
  const { market, side, leverage } = useLocalSearchParams<{ market: string; side?: string; leverage?: string }>();
  const lev = leverage === undefined ? undefined : Number.parseInt(leverage, 10);
  return (
    <TicketScreen
      marketId={(market ?? DEFAULT_MARKET).toUpperCase()}
      side={side === "short" ? "short" : side === "long" ? "long" : undefined}
      leverage={lev !== undefined && Number.isInteger(lev) && lev >= 1 ? lev : undefined}
    />
  );
}
