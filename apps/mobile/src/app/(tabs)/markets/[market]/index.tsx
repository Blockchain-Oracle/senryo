import { useLocalSearchParams } from "expo-router";
import { TradeScreen } from "~/features/trade/TradeScreen";
import { DEFAULT_MARKET } from "~/lib/constants/routes";

/** `/markets/[market]` — market detail on the Markets stack (the old `/trade/[market]`, S1b.7). */
export default function MarketDetail() {
  const { market } = useLocalSearchParams<{ market: string }>();
  return <TradeScreen marketId={(market ?? DEFAULT_MARKET).toUpperCase()} />;
}
