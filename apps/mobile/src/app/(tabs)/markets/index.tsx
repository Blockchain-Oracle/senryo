import { ENGINE_MARKETS } from "@senryo/config";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { Panel } from "~/components/kit/Surface";
import { EmptyState } from "~/components/kit/states";
import { ProtocolBanner } from "~/features/markets/MarketBanners";
import { EngineMarketRow, type UpcomingMarket, UpcomingMarketRow } from "~/features/markets/MarketRow";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { HAIRLINE_PX, SPACE, TYPE, useTheme } from "~/theme";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "metals", label: "Gold" },
  { value: "crypto", label: "Crypto" },
  { value: "fx", label: "FX" },
  { value: "equity", label: "Equity" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

/** Markets that aren't live yet — names and why only (Perpl crypto lands in S7; FX/equities need a live feed). */
const UPCOMING: ReadonlyArray<UpcomingMarket & { assetClass: Exclude<Filter, "all" | "metals"> }> = [
  { symbol: "BTC", name: "Bitcoin", venue: "Perpl", note: "Mainnet · arriving next", assetClass: "crypto" },
  { symbol: "ETH", name: "Ether", venue: "Perpl", note: "Mainnet · arriving next", assetClass: "crypto" },
  { symbol: "MON", name: "Monad", venue: "Perpl", note: "Mainnet · arriving next", assetClass: "crypto" },
  { symbol: "EURUSD", name: "Euro / Dollar", venue: "Senryo", note: "Waits for a live price feed", assetClass: "fx" },
  { symbol: "NVDA", name: "Nvidia", venue: "Senryo", note: "Waits for a live price feed", assetClass: "equity" },
];

/** Markets (D2): asset-class filter and the dense perps watchlist. Browsable without an account (F03). */
export default function Markets() {
  const { color } = useTheme();
  const [filter, setFilter] = useState<Filter>("all");
  const metals = filter === "all" || filter === "metals" ? ENGINE_MARKETS : [];
  const upcoming = UPCOMING.filter((m) => filter === "all" || m.assetClass === filter);
  const count = metals.length + upcoming.length;
  return (
    <Screen>
      <ProtocolBanner />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Asset class" />
      {count === 0 ? (
        <EmptyState
          why="Nothing in this class yet"
          detail="Gold and silver are live first; FX and equities follow when live price feeds are available."
          action={{ label: "Show all markets", onPress: () => setFilter("all") }}
        />
      ) : (
        <Panel>
          <View style={[styles.head, { borderBottomColor: color.hairline }]}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Perps · 24h</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>
              {ACTIVE_NETWORK.modeLabel.toUpperCase()} · Oracle: Chainlink
            </Text>
          </View>
          {metals.map((m, i) => (
            <EngineMarketRow key={m.id} marketId={m.id} first={i === 0} />
          ))}
          {upcoming.map((m, i) => (
            <UpcomingMarketRow key={m.symbol} market={m} first={metals.length === 0 && i === 0} />
          ))}
        </Panel>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACE.md,
    borderBottomWidth: HAIRLINE_PX,
  },
});
