import { MARKETS } from "@senryo/config";
import { type Href, Redirect, useLocalSearchParams } from "expo-router";
import { SearchMarketScreen } from "~/features/search/SearchMarketScreen";

/** A market's page in search (R6.4): its trade, lanes, proof and star. An unknown symbol goes back to search. */
export default function SearchMarket() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const market = MARKETS.find((m) => m.symbol === symbol?.toUpperCase());
  if (!market) return <Redirect href={"/search" as Href} />;
  return <SearchMarketScreen symbol={market.symbol} />;
}
