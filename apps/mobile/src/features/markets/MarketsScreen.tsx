/**
 * Markets (S7.3): every market on this network in its kind groups, with a search and the kind filter (the Calls
 * filter's `Segmented`); each row (F7, research 10 §2) is the real mark, name, the 1-minute window's countdown while it
 * trades or its session in words while it doesn't (`@senryo/calls` `marketLine`), the day's sparkline against the
 * price 24 hours ago (D-319), the live price — the last print, muted, when closed — with its 24 h change, and a
 * chevron. Tapping one opens the terminal there. Prices render at most once a frame; the graph and change once a second.
 */
import { groupMarkets, MARKET_FILTERS, type MarketFilter } from "@senryo/calls";
import { useCatalog } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { SearchField } from "~/components/kit/SearchField";
import { Segmented } from "~/components/kit/Segmented";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { fire } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";
import { MarketRow } from "./MarketRow";
import { RoundClock } from "./RoundClock";

export function MarketsScreen() {
  const { color } = useTheme();
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const open = (symbol: string) => {
    fire("tick");
    setSymbol(symbol);
    router.navigate("/trade");
  };
  const groups = "value" in catalog ? groupMarkets(catalog.value.markets, query, filter) : [];
  return (
    <CollapsingScreen left={<TabTitle>Markets</TabTitle>}>
      {catalog.status === "unknown" ? (
        <LoadingState />
      ) : !("value" in catalog) ? (
        <EmptyState why="Markets are unavailable" detail="Pull to try again." />
      ) : (
        <View style={styles.page}>
          <SearchField value={query} onChange={setQuery} />
          <Segmented options={MARKET_FILTERS} value={filter} onChange={setFilter} label="Show markets" />
          <RoundClock />
          {groups.length === 0 ? (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>Nothing matches “{query}”.</Text>
          ) : (
            groups.map((g) => (
              <View key={g.label} accessibilityRole="list" accessibilityLabel={g.label}>
                <Text style={[TYPE.sectionTitle, styles.heading, { color: color.inkMuted }]}>{g.label}</Text>
                {g.markets.map((m) => (
                  <MarketRow key={m.symbol} symbol={m.symbol} name={m.name} onOpen={() => open(m.symbol)} />
                ))}
              </View>
            ))
          )}
        </View>
      )}
    </CollapsingScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.md },
  heading: { paddingTop: SPACE.sm, paddingBottom: SPACE.xs },
});
