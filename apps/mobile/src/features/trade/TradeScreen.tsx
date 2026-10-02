import { DISCOVERY_INSTRUMENTS, type EngineMarket, engineMarket, engineMarketsOn } from "@senryo/config";
import { ids } from "@senryo/identity";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { Button } from "~/components/kit/Button";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { SCROLL_THROTTLE_MS } from "~/components/shell/constants";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { DiscoveryDetail } from "~/features/markets/DiscoveryDetail";
import { MarketAbout } from "~/features/markets/MarketAbout";
import { MarketActions, marketShareUrl } from "~/features/markets/MarketActions";
import { HolidayBanner } from "~/features/markets/MarketBanners";
import { MarketChart } from "~/features/markets/MarketChart";
import { MarketFeed } from "~/features/markets/MarketFeed";
import { MarketHolders } from "~/features/markets/MarketHolders";
import { PageHeader, PageTitle } from "~/features/markets/PageHeader";
import { QuietLine } from "~/features/markets/QuietLine";
import { type MarketLine, useMarketLine } from "~/features/markets/useMarketLine";
import { ROUTES } from "~/lib/constants/routes";
import { priceDecimalsOf } from "~/lib/money";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { EASE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { HeldRow, OwnItRow } from "./MarketLinks";
import { PrelaunchDetail } from "./PrelaunchDetail";
import { SideBar } from "./SideBar";
import { CompactPrice, MarketIdentity, PriceBlock } from "./TradeHeader";

/** F32's order: who holds it, what they're doing, then what it is. */
const TABS = [
  { value: "holders", label: "Holders" },
  { value: "feed", label: "Feed" },
  { value: "about", label: "About" },
] as const;
type DetailTab = (typeof TABS)[number]["value"];

/** The bar swaps its circles for the compact price once the big price has scrolled under it (F32 → F33). */
const COLLAPSE_AT = SPACE.sm + (TYPE.displayPrice.lineHeight ?? 0);

/**
 * Market detail (`/markets/[market]`; Fomo F32–F35; flow book C2; plan §0.9 Market detail): mark, ticker, badge and
 * venue in the bar with Alert · Watch · Share · History → price, 24 h change and open interest → candles with period
 * chips → "Own real gold ›" on XAU and "Your position ›" when one is open → Holders · Feed · About → a state banner
 * when the market isn't open → sticky Short / Long. A crypto ticker (`/markets/BTC`) opens its read-only page; on
 * Mainnet before the deploy the page shows the live Chainlink price with "Opening soon".
 */
export function TradeScreen({ marketId }: { marketId: string }) {
  const meta = engineMarket(marketId);
  const network = useNetwork();
  const readOnly = useReadOnlyNetwork();
  useHideDockWhileFocused("market-detail");
  if (!meta) {
    const discovery = DISCOVERY_INSTRUMENTS.find((i) => i.symbol.toUpperCase() === marketId.toUpperCase());
    if (discovery) return <DiscoveryDetail id={discovery.id} />;
    return <NotListed title={marketId} />;
  }
  if (readOnly) return <PrelaunchDetail meta={meta} />;
  if (!engineMarketsOn(network.chainId).some((m) => m.id === meta.id)) return <NotListed title={meta.symbol} />;
  return <EngineMarketDetail meta={meta} />;
}

/** A market this network doesn't list: the same bar with a plain title, one line, and the way back to the list. */
function NotListed({ title }: { title: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader>
        <PageTitle>{title}</PageTitle>
      </PageHeader>
      <Screen>
        <QuietLine>Not listed here</QuietLine>
        <Button label="See all markets" variant="secondary" onPress={() => router.navigate(ROUTES.markets)} />
      </Screen>
    </View>
  );
}

function EngineMarketDetail({ meta }: { meta: EngineMarket }) {
  const { color } = useTheme();
  const network = useNetwork();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const line = useMarketLine(meta.id, meta.symbol);
  const refreshControl = usePullRefresh();
  const [tab, setTab] = useState<DetailTab>("holders");
  const [collapsed, setCollapsed] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  useAnimatedReaction(
    () => scrollY.value > COLLAPSE_AT,
    (now, was) => {
      if (now !== was) scheduleOnRN(setCollapsed, now);
    },
  );
  const known = line.status === "fresh" || line.status === "stale" ? line.value : undefined;
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader
        right={
          <BarRight
            collapsed={collapsed && known !== undefined}
            actions={
              <MarketActions
                name={meta.name}
                watchKey={meta.symbol}
                shareUrl={marketShareUrl(meta.symbol)}
                alertFor={meta.symbol}
                historyFor={meta.symbol}
              />
            }
            compact={known ? <CompactPrice line={known} /> : null}
          />
        }
      >
        <MarketIdentity
          mark={ids.engineMarket(network.chainId, meta.id)}
          symbol={meta.symbol}
          name={meta.name}
          maxLeverageX={known?.maxLeverageX}
        />
      </PageHeader>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={SCROLL_THROTTLE_MS}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}
      >
        <ReadingView
          reading={line}
          loading="line"
          loadingLabel="Reading the oracle"
          retry={() => void client.invalidateQueries()}
        >
          {(l) => <Body line={l} tab={tab} onTab={setTab} />}
        </ReadingView>
      </Animated.ScrollView>
      <SideBar symbol={meta.symbol} status={known?.status} calendarId={known?.market.calendarId ?? 0} />
    </View>
  );
}

function Body({ line, tab, onTab }: { line: MarketLine; tab: DetailTab; onTab: (next: DetailTab) => void }) {
  return (
    <>
      <PriceBlock line={line} />
      <HolidayBanner calendarId={line.market.calendarId} name={line.name} />
      <MarketChart line={line} />
      <View style={styles.links}>
        <HeldRow marketId={line.marketId} />
        <OwnItRow symbol={line.symbol} />
      </View>
      <View style={styles.tabs}>
        <UnderlineTabs options={TABS} value={tab} onChange={onTab} label={`${line.name} details`} />
        <Animated.View key={tab} entering={FadeIn.duration(TIMING.selection)}>
          {tab === "holders" ? (
            <MarketHolders marketId={line.marketId} name={line.name} decimals={priceDecimalsOf(line.marketId)} />
          ) : tab === "feed" ? (
            <MarketFeed marketId={line.marketId} name={line.name} />
          ) : (
            <MarketAbout line={line} />
          )}
        </Animated.View>
      </View>
    </>
  );
}

/**
 * The bar's right side (F32 → F33): the circles at rest; once the price block has scrolled away they fade out and
 * the compact price fades in over them, so the price never leaves the screen. The circles return at the top.
 */
function BarRight({ collapsed, actions, compact }: { collapsed: boolean; actions: ReactNode; compact: ReactNode }) {
  const swap = useSharedValue(0);
  useEffect(() => {
    swap.value = withTiming(collapsed ? 1 : 0, { duration: TIMING.selection, easing: EASE });
  }, [collapsed, swap]);
  const actionsStyle = useAnimatedStyle(() => ({ opacity: 1 - swap.value }));
  const compactStyle = useAnimatedStyle(() => ({ opacity: swap.value }));
  return (
    <View>
      <Animated.View style={actionsStyle} pointerEvents={collapsed ? "none" : "auto"}>
        {actions}
      </Animated.View>
      <Animated.View
        style={[styles.compact, compactStyle]}
        pointerEvents="none"
        accessibilityElementsHidden={!collapsed}
        importantForAccessibility={collapsed ? "auto" : "no-hide-descendants"}
      >
        {compact}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  links: { gap: SPACE.xxs },
  tabs: { gap: SPACE.lg },
  compact: { position: "absolute", top: 0, bottom: 0, right: 0, justifyContent: "center" },
});
