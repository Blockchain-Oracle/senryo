import { useLocalSearchParams } from "expo-router";
import { TradeScreen } from "~/features/trade/TradeScreen";
import { DEFAULT_MARKET } from "~/lib/constants/routes";

export default function TradeMarket() {
  const { market } = useLocalSearchParams<{ market: string }>();
  return <TradeScreen marketId={(market ?? DEFAULT_MARKET).toUpperCase()} pushed />;
}
