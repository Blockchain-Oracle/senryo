import { MarketsScreen } from "~/features/markets/MarketsScreen";

/**
 * Markets tab root (J3/J11; Fomo F09–F12; flow book C1): Watchlist · Tokens · Perps with their chips and one
 * FlashList of rows. Browsable without an account. On Mainnet before the engine deploy the engine rows stay listed
 * with live Chainlink prices and "Soon" — there is no full-screen prelaunch page. A row opens its detail on this stack.
 */
export default function Markets() {
  return <MarketsScreen />;
}
