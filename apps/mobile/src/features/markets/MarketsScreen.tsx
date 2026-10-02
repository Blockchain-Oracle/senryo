/**
 * The Markets tab (Fomo F09–F12; flow book C1; plan §0.9 Markets): the title, search and mode in a fixed bar; the
 * Watchlist · Tokens · Perps tabs and their chips pinned under it; then one FlashList of rows (recycled — no
 * per-row stagger, rule A7). Perps and Watchlist share the chips All · Commodities · FX · Crypto · Equities; Tokens
 * has All · Trending · Gainers. One dismissible "Go long or short" card leads Perps. The list fades in once per tab.
 */
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChipRow } from "~/components/kit/ChipRow";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { Search, Star } from "~/components/kit/symbols";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { useDockInset } from "~/components/shell/dock-context";
import { ModeCapsule } from "~/components/shell/ModeCapsule";
import { TabTitle } from "~/components/shell/TabTitle";
import { UTILITY_ICON, UtilityButton } from "~/components/shell/Utilities";
import { TokenRow } from "~/features/tokens/TokenRow";
import { TOKEN_SORTS, type TokenSort } from "~/features/tokens/useTokenRows";
import { ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { DiscoveryRow, UnpricedRow } from "./DiscoveryRow";
import { ProtocolBanner } from "./MarketBanners";
import { EngineMarketRow, PrelaunchMarketRow } from "./MarketRow";
import { type MarketItem, type MarketsView, useMarketItems } from "./market-items";
import { PerpsIntro } from "./PerpsIntro";
import { QuietLine } from "./QuietLine";
import { MARKET_FILTERS, type MarketFilter } from "./universe";

/** F10's three lists: what you starred, the spot tokens, the perpetuals. */
const VIEWS = [
  { value: "watchlist", label: "Watchlist", icon: Star },
  { value: "tokens", label: "Tokens" },
  { value: "perps", label: "Perps" },
] as const;

export function MarketsScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useDockInset();
  const refreshControl = usePullRefresh();
  const [view, setView] = useState<MarketsView>("perps");
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [tokenSort, setTokenSort] = useState<TokenSort>("all");
  const items = useMarketItems(view, filter, tokenSort);
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.bar}>
          <View style={styles.title}>
            <TabTitle>Markets</TabTitle>
          </View>
          <UtilityButton label="Search markets, tokens and traders" onPress={() => router.push(ROUTES.marketSearch)}>
            <Search size={UTILITY_ICON} strokeWidth={SIZE.iconStroke} color={color.ink} />
          </UtilityButton>
          <ModeCapsule />
        </View>
      </View>
      <View style={styles.controls}>
        <View style={styles.tabs}>
          <UnderlineTabs options={VIEWS} value={view} onChange={setView} label="Market list" />
        </View>
        {view === "tokens" ? (
          <ChipRow options={TOKEN_SORTS} value={tokenSort} onChange={setTokenSort} label="Token order" />
        ) : (
          <ChipRow options={MARKET_FILTERS} value={filter} onChange={setFilter} label="Market category" />
        )}
      </View>
      <Animated.View key={view} entering={FadeIn.duration(TIMING.selection)} style={styles.fill}>
        <FlashList
          data={items}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          renderItem={({ item }) => <Row item={item} />}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, paddingBottom: bottom }}
        />
      </Animated.View>
    </View>
  );
}

function Row({ item }: { item: MarketItem }) {
  const { color } = useTheme();
  switch (item.kind) {
    case "intro":
      return (
        <View style={styles.gap}>
          <PerpsIntro />
        </View>
      );
    case "banner":
      return (
        <View style={styles.gapIfAny}>
          <ProtocolBanner />
        </View>
      );
    case "engine":
      return <EngineMarketRow marketId={item.marketId} />;
    case "prelaunch":
      return <PrelaunchMarketRow marketId={item.marketId} price={item.price} />;
    case "discovery":
      return <DiscoveryRow instrument={item.instrument} reading={item.reading} />;
    case "unpriced":
      return <UnpricedRow instrument={item.instrument} />;
    case "token":
      return (
        <TokenRow
          token={item.row.token}
          priceUsd18={item.row.priceUsd18}
          change24hBps={item.row.change24hBps}
          held={item.row.held}
        />
      );
    case "empty":
      return <QuietLine>{item.text}</QuietLine>;
    case "credit":
      return <Text style={[TYPE.meta, styles.credit, { color: color.text3 }]}>{item.text}</Text>;
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    minHeight: SIZE.touch + SPACE.md,
    paddingHorizontal: SIZE.gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  title: { flex: 1, minWidth: 0 },
  controls: { gap: SPACE.sm, paddingBottom: SPACE.xs },
  tabs: { paddingHorizontal: SIZE.gutter },
  gap: { paddingBottom: SPACE.md },
  gapIfAny: { paddingBottom: SPACE.xs },
  credit: { paddingTop: SPACE.md },
});
