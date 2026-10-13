/**
 * A market's page in the phone's search (R6.4, Codex direction 13; the rows are `@senryo/calls` `marketPageRows`, the
 * web's own): "Search / BTC" over a field that narrows the rows — Trade (Up, Down, Ride: each opens the terminal
 * ready, never placing), Lanes (a tap picks one here), Market (its proof on the web, its star). Back returns to the
 * search as it was.
 */
import { type MarketPageRow, marketPageRows, proofFeedPath, readSymbols, toggleFavourite } from "@senryo/calls";
import { useMarketLanes } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { marketId } from "@senryo/identity";
import { intentParams } from "@senryo/search";
import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { ArrowDown, ArrowUp, ChartLine, ChevronLeft, ScrollText, Star } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const HEADER = 52;
const FIELD = 44;
const BACK_ICON = 22;
const CRUMB_MARK = 28;
const SECTIONS = ["Trade", "Lanes", "Market"] as const;
const DISABLED = 0.45;

export function SearchMarketScreen({ symbol }: { symbol: string }) {
  // Pull down refreshes the page (D4: the owner's iPhone review — every screen with data refreshes).
  const refresh = usePullRefresh();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { line, lanes } = useMarketLanes(symbol);
  const [lane, setLane] = useState<CadenceSec | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [favRaw, setFavRaw] = useMMKVString(STORAGE_KEYS.favouriteMarkets, storage);
  const favourites = readSymbols(favRaw);
  const rows = marketPageRows({
    symbol,
    lane,
    lanes,
    lineText: line.text,
    starred: favourites.includes(symbol),
    query,
  });

  const run = (row: MarketPageRow) => {
    const act = row.act;
    switch (act.kind) {
      case "open":
        fire("press", { cue: "tap" });
        return router.navigate({ pathname: "/trade", params: { symbol, ...intentParams(act.intent) } });
      case "lane":
        fire("tick");
        return setLane(act.lane);
      case "proof":
        fire("tick", { cue: "tap" });
        return router.push(proofFeedPath(symbol) as Href);
      case "star":
        fire("tick", { cue: "toggle" });
        return setFavRaw(JSON.stringify(toggleFavourite(favourites, symbol)));
    }
  };
  const glyph = (row: MarketPageRow) => {
    switch (row.icon) {
      case "up":
        return <ArrowUp size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.up} />;
      case "down":
        return <ArrowDown size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.down} />;
      case "ride":
        return <ChartLine size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.inkMuted} />;
      case "lane":
        return <EntityMark id={marketId(symbol)} size={SIZE.avatarSm} decorative />;
      case "proof":
        return <ScrollText size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.inkMuted} />;
      case "star":
        return (
          <Star
            size={SIZE.icon}
            strokeWidth={SIZE.iconStroke}
            color={row.on ? color.gold : color.inkMuted}
            {...(row.on ? { fill: color.gold } : {})}
          />
        );
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top + SPACE.sm }]}>
      <View style={styles.crumbs}>
        <Pressable
          onPress={() => {
            fire("tick");
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Back to search"
          style={styles.back}
        >
          <ChevronLeft size={BACK_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
        </Pressable>
        <Text style={[TYPE.body, { color: color.inkMuted }]}>Search /</Text>
        <Text style={[TYPE.bodyStrong, styles.here, { color: color.ink }]}>{symbol}</Text>
        <EntityMark id={marketId(symbol)} size={CRUMB_MARK} decorative />
      </View>
      <View style={[styles.field, { backgroundColor: color.muted }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${symbol} actions`}
          placeholderTextColor={color.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={`Search ${symbol} actions`}
          style={[TYPE.field, styles.input, { color: color.ink }]}
        />
      </View>
      <ScrollView
        refreshControl={refresh}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xl }]}
      >
        {SECTIONS.map((section) => {
          const list = rows.filter((r) => r.section === section);
          return list.length === 0 ? null : (
            <View key={section} style={styles.section}>
              <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
                {section}
              </Text>
              {list.map((row) => (
                <Pressable
                  key={row.id}
                  disabled={row.disabled ?? false}
                  onPress={() => run(row)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: row.disabled ?? false, selected: row.on ?? false }}
                  accessibilityLabel={`${row.title}${row.sub ? `, ${row.sub}` : ""}`}
                  style={({ pressed }) => [
                    styles.row,
                    row.disabled && { opacity: DISABLED },
                    pressed && { backgroundColor: color.rowPressed },
                  ]}
                >
                  <View style={styles.glyph}>{glyph(row)}</View>
                  <View style={styles.copy}>
                    <Text style={[TYPE.rowTitle, { color: color.ink }]}>{row.title}</Text>
                    {row.sub ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{row.sub}</Text> : null}
                  </View>
                  {row.icon === "lane" && row.on ? (
                    <Text
                      style={[
                        TYPE.label,
                        styles.picked,
                        { backgroundColor: color.accent, color: color.accentForeground },
                      ]}
                    >
                      Selected
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  crumbs: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, height: HEADER, paddingHorizontal: SPACE.md },
  back: { width: SIZE.touch, height: SIZE.touch, alignItems: "center", justifyContent: "center" },
  here: { flex: 1 },
  field: { height: FIELD, marginHorizontal: SPACE.inset, paddingHorizontal: SPACE.md, borderRadius: RADIUS.xs },
  input: { flex: 1, height: FIELD },
  content: { paddingHorizontal: SPACE.inset, gap: SPACE.xl, paddingTop: SPACE.lg },
  section: { gap: SPACE.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.touch + SPACE.md,
    marginHorizontal: -SPACE.sm,
    paddingHorizontal: SPACE.sm,
  },
  glyph: { width: SIZE.avatarSm, alignItems: "center" },
  copy: { flex: 1, gap: SPACE.xxs },
  picked: { paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, borderRadius: RADIUS.xs, overflow: "hidden" },
});
