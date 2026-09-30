import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PreviewBadge } from "~/components/kit/PreviewBadge";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { Panel } from "~/components/kit/Surface";
import { MarketRow } from "~/features/markets/MarketRow";
import { type AssetClass, SAMPLE_MARKETS } from "~/lib/sample";
import { useSample } from "~/lib/useSample";
import { HAIRLINE_PX, SPACE, TYPE, useTheme } from "~/theme";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "metals", label: "Gold" },
  { value: "crypto", label: "Crypto" },
  { value: "fx", label: "FX" },
  { value: "equity", label: "Equity" },
] as const;
type Filter = "all" | AssetClass;

/** Markets (D2): asset-class filter and the dense perps watchlist. Browsable without an account (F03). */
export default function Markets() {
  const { color } = useTheme();
  const [filter, setFilter] = useState<Filter>("all");
  const markets = useSample("markets", SAMPLE_MARKETS);
  return (
    <Screen>
      <PreviewBadge />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} label="Asset class" />
      <ReadingView reading={markets} loading="list" loadingLabel="Loading markets">
        {(all) => {
          const list = filter === "all" ? all : all.filter((m) => m.assetClass === filter);
          if (list.length === 0) {
            return (
              <EmptyState
                why="Nothing in this class yet"
                detail="Gold and silver are live first; FX and equities follow when live price feeds are available."
                action={{ label: "Show all markets", onPress: () => setFilter("all") }}
              />
            );
          }
          return (
            <Panel>
              <View style={[styles.head, { borderBottomColor: color.hairline }]}>
                <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Perps · 24h</Text>
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>{list.length} assets</Text>
              </View>
              {list.map((m, i) => (
                <MarketRow key={m.id} market={m} first={i === 0} />
              ))}
            </Panel>
          );
        }}
      </ReadingView>
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
