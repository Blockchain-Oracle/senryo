/**
 * Markets (S7.3): every market on this network in its kind groups, with a search and the kind filter (the Calls
 * filter's `Segmented`); each row is the real mark, name, the 1-minute window's countdown while it trades or its
 * session in words while it doesn't (`@senryo/calls` `marketLine`), and the live price — the last print, muted, when
 * closed. Tapping one opens the terminal there. Prices render at most once a frame (lists, not the terminal).
 */
import { groupMarkets, MARKET_FILTERS, type MarketFilter, unitOf } from "@senryo/calls";
import { useMarketLine } from "@senryo/calls/react";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { useCatalog } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { EntityMark } from "~/components/identity/EntityMark";
import { Segmented } from "~/components/kit/Segmented";
import { EmptyState, LoadingState } from "~/components/kit/states";
import { Search } from "~/components/kit/symbols";
import { CollapsingScreen } from "~/components/shell/CollapsingScreen";
import { TabTitle } from "~/components/shell/TabTitle";
import { fire } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { formatValue, priceDecimals } from "../terminal/chart/engine";

const MARK = 40;
const E8 = 1e8;
const SEARCH_ICON = 18;

export function MarketRow({ symbol, name, onOpen }: { symbol: string; name: string; onOpen: () => void }) {
  const { color } = useTheme();
  const price = useLivePrice(symbol);
  const line = useMarketLine(symbol);
  const points = unitOf(symbol) === "points";
  const text = price ? formatValue(price / E8, priceDecimals(price / E8), points) : undefined;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${name}${text ? `, ${text}` : ""}. ${line.trading ? "" : `${line.text}. `}Open the terminal`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.rowPressed }]}
    >
      <EntityMark id={marketId(symbol)} size={MARK} decorative />
      <View style={styles.text}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>{symbol}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={1}>
          {name} · {line.text}
        </Text>
      </View>
      <Text style={[TYPE.rowTitle, { color: line.trading ? color.ink : color.inkMuted }]}>{text ?? "—"}</Text>
    </Pressable>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { color } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: color.muted }]}>
      <Search size={SEARCH_ICON} color={color.inkMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search markets"
        placeholderTextColor={color.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel="Search markets"
        style={[TYPE.body, styles.searchInput, { color: color.ink }]}
      />
    </View>
  );
}

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
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.touch + SPACE.xl },
  text: { flex: 1 },
  heading: { paddingTop: SPACE.sm, paddingBottom: SPACE.xs },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.touch,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
  },
  searchInput: { flex: 1, minHeight: SIZE.touch },
});
