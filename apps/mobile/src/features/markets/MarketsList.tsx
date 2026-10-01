import { engineMarketsOn } from "@senryo/config";
import { StyleSheet, Text, View } from "react-native";
import { SectionLabel } from "~/components/kit/Surface";
import { useNetwork } from "~/lib/network";
import { CONTROL_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";
import { ProtocolBanner } from "./MarketBanners";
import { ArrivingMarketRow, EngineMarketRow } from "./MarketRow";
import { QuietLine } from "./QuietLine";
import { arrivingMarkets, inFilter, MARKET_FILTERS, type MarketFilter, tradeableMarkets } from "./universe";
import { useWatchlist } from "./useWatchlist";

export type MarketsView = "watchlist" | "tokens" | "perps";

/**
 * The Markets list (Fomo F09/F12; direction §8). **Perps**: the markets that trade on this network lead, bare on the
 * page; the ones that don't trade here yet follow under a quiet "Arriving" label — real mark and name, one short
 * reason, never a price. **Watchlist**: the markets starred on this phone, newest star first; with none, one quiet
 * line and nothing else. The category chips narrow both.
 */
export function MarketsList({ view, filter }: { view: Exclude<MarketsView, "tokens">; filter: MarketFilter }) {
  return (
    <>
      <ProtocolBanner />
      {view === "watchlist" ? <Watchlist filter={filter} /> : <AllMarkets filter={filter} />}
    </>
  );
}

function Watchlist({ filter }: { filter: MarketFilter }) {
  const network = useNetwork();
  const watchlist = useWatchlist();
  const listed = engineMarketsOn(network.chainId);
  const starred = watchlist.symbols.flatMap((symbol) => listed.find((m) => m.symbol === symbol) ?? []);
  if (starred.length === 0) return <QuietLine>Star a market to keep it here</QuietLine>;
  const shown = starred.filter((m) => inFilter(m, filter));
  if (shown.length === 0) {
    const category = MARKET_FILTERS.find((f) => f.value === filter)?.label ?? "";
    return <QuietLine>Nothing starred in {category}</QuietLine>;
  }
  return (
    <View>
      <ListCaption />
      {shown.map((m) => (
        <EngineMarketRow key={m.id} marketId={m.id} />
      ))}
    </View>
  );
}

function AllMarkets({ filter }: { filter: MarketFilter }) {
  const network = useNetwork();
  const tradeable = tradeableMarkets(network.chainId, filter);
  const arriving = arrivingMarkets(network.chainId, filter);
  if (tradeable.length + arriving.length === 0) return <QuietLine>Nothing in this category yet</QuietLine>;
  return (
    <>
      {tradeable.length > 0 ? (
        <View>
          <ListCaption />
          {tradeable.map((m) => (
            <EngineMarketRow key={m.id} marketId={m.id} />
          ))}
        </View>
      ) : null}
      {arriving.length > 0 ? (
        <View>
          <SectionLabel style={styles.label}>Arriving</SectionLabel>
          {arriving.map((m) => (
            <ArrivingMarketRow key={m.symbol} market={m} />
          ))}
        </View>
      ) : null}
    </>
  );
}

/** What the rows' numbers are: the 24 h change, priced by the Chainlink oracle. */
function ListCaption() {
  const { color } = useTheme();
  return (
    <View style={styles.caption}>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
        Perps · 24h
      </Text>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
        Oracle: Chainlink
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: SPACE.sm },
  label: { paddingBottom: SPACE.xs },
});
