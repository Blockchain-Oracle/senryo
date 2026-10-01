import { engineMarketsOn } from "@senryo/config";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChipRow } from "~/components/kit/ChipRow";
import { Panel } from "~/components/kit/Surface";
import { EmptyState } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { ProtocolBanner } from "~/features/markets/MarketBanners";
import { EngineMarketRow, type UpcomingMarket, UpcomingMarketRow } from "~/features/markets/MarketRow";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { HAIRLINE_PX, SPACE, TYPE, useTheme } from "~/theme";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "commodities", label: "Commodities" },
  { value: "fx", label: "FX" },
  { value: "crypto", label: "Crypto" },
  { value: "equities", label: "Equities" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

/** Markets that aren't live yet — names and why only (Perpl crypto lands in S7; equities need a live feed, D-220). */
const UPCOMING: ReadonlyArray<UpcomingMarket & { assetClass: Exclude<Filter, "all" | "commodities"> }> = [
  { symbol: "BTC", name: "Bitcoin", venue: "Perpl", note: "Mainnet · arriving next", assetClass: "crypto" },
  { symbol: "ETH", name: "Ether", venue: "Perpl", note: "Mainnet · arriving next", assetClass: "crypto" },
  { symbol: "MON", name: "Monad", venue: "Perpl", note: "Mainnet · arriving next", assetClass: "crypto" },
  { symbol: "EUR", name: "Euro", venue: "Senryo", note: "Listing on practice after the timelock", assetClass: "fx" },
  { symbol: "NVDA", name: "Nvidia", venue: "Senryo", note: "Waits for a live price feed", assetClass: "equities" },
];

/**
 * Markets tab root (S1b.7 shell; J3 rebuilds the list in S1b.9): the title and mode stay in the fixed bar and the
 * category chips pin under it (C16, direction §5). Browsable without an account (F03). Mainnet before launch shows
 * live prices read-only (S8.22). A row opens market detail on this stack; the ticket opens from there.
 */
export default function Markets() {
  const readOnly = useReadOnlyNetwork();
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <CollapsingScreen
      tab="markets"
      left={<TabTitle>Markets</TabTitle>}
      sticky={
        readOnly ? undefined : (
          <View style={styles.chips}>
            <ChipRow options={FILTERS} value={filter} onChange={setFilter} label="Market category" />
          </View>
        )
      }
    >
      {readOnly ? (
        <PrelaunchMainnet surface="markets" />
      ) : (
        <MarketsList filter={filter} onShowAll={() => setFilter("all")} />
      )}
    </CollapsingScreen>
  );
}

function MarketsList({ filter, onShowAll }: { filter: Filter; onShowAll: () => void }) {
  const network = useNetwork();
  const { color } = useTheme();
  const listed = engineMarketsOn(network.chainId);
  const engine = listed.filter(
    (m) =>
      filter === "all" ||
      (filter === "commodities" && m.category === "metal") ||
      (filter === "fx" && m.category === "fx"),
  );
  const upcoming = UPCOMING.filter(
    (m) => (filter === "all" || m.assetClass === filter) && !listed.some((l) => l.symbol === m.symbol),
  );
  const count = engine.length + upcoming.length;
  return (
    <>
      <ProtocolBanner />
      {count === 0 ? (
        <EmptyState
          why="Nothing in this category yet"
          detail="Gold and silver are live first; FX and equities follow when live price feeds are available."
          action={{ label: "Show all markets", onPress: onShowAll }}
        />
      ) : (
        <Panel>
          <View style={[styles.head, { borderBottomColor: color.hairline }]}>
            <Text style={[TYPE.rowStrong, { color: color.ink }]}>Perps · 24h</Text>
            <Text style={[TYPE.meta, { color: color.text3 }]}>Oracle: Chainlink</Text>
          </View>
          {engine.map((m, i) => (
            <EngineMarketRow key={m.id} marketId={m.id} first={i === 0} />
          ))}
          {upcoming.map((m, i) => (
            <UpcomingMarketRow key={m.symbol} market={m} first={engine.length === 0 && i === 0} />
          ))}
        </Panel>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { paddingVertical: SPACE.sm },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACE.md,
    borderBottomWidth: HAIRLINE_PX,
  },
});
