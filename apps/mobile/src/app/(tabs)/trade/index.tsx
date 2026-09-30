import { TradeScreen } from "~/features/trade/TradeScreen";
import { DEFAULT_MARKET } from "~/lib/constants/routes";

export default function TradeTab() {
  return <TradeScreen marketId={DEFAULT_MARKET} pushed={false} />;
}
