import { type EngineMarket, engineMarket, engineMarketsOn } from "@senryo/config";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { usePressScale } from "~/components/kit/usePressScale";
import { SCROLL_THROTTLE_MS } from "~/components/shell/constants";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { MarketAbout } from "~/features/markets/MarketAbout";
import { MarketActions } from "~/features/markets/MarketActions";
import { HolidayBanner, ProtocolBanner } from "~/features/markets/MarketBanners";
import { MarketChart } from "~/features/markets/MarketChart";
import { MarketFeed } from "~/features/markets/MarketFeed";
import { PageHeader, PageTitle } from "~/features/markets/PageHeader";
import { QuietLine } from "~/features/markets/QuietLine";
import { type MarketLine, useMarketLine } from "~/features/markets/useMarketLine";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { fire } from "~/feedback/fire";
import { type TicketSide, ticketRoute } from "~/lib/constants/routes";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { BUTTON, EASE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { CompactPrice, MarketIdentity, PriceBlock } from "./TradeHeader";

const TABS = [
  { value: "about", label: "About" },
  { value: "feed", label: "Feed" },
] as const;
type DetailTab = (typeof TABS)[number]["value"];

/** The bar swaps its utilities for the compact price once the big price has scrolled under it (F32 → F33). */
const COLLAPSE_AT = SPACE.sm + (TYPE.displayPrice.lineHeight ?? 0);

/**
 * Market detail (`/markets/[market]`, J3; Fomo F32–F35, direction §8): identity and utilities in the bar → price,
 * change, open interest and freshness → candles with the current-price line and period chips → About / Feed → sticky
 * Short / Long. Like Fomo's detail it hides the dock: the bottom zone belongs to Short / Long, which open the order
 * ticket on that side over this page (M13 → C39). Dismissing the ticket restores this page with its scroll (FT112).
 * There is no Holders tab: nothing we can read lists public positions per market, and the tab is not faked.
 */
export function TradeScreen({ marketId }: { marketId: string }) {
  const meta = engineMarket(marketId);
  const network = useNetwork();
  const readOnly = useReadOnlyNetwork();
  useHideDockWhileFocused("market-detail");
  const listed = meta !== undefined && engineMarketsOn(network.chainId).some((m) => m.id === meta.id);
  if (meta && listed && !readOnly) return <EngineMarketDetail meta={meta} />;
  return (
    <Plain title={marketId}>
      {readOnly ? (
        <PrelaunchMainnet surface="trade" />
      ) : (
        <QuietLine>
          {meta ? `${meta.name} isn't listed in ${network.modeLabel} yet` : `${marketId} isn't tradeable here yet`}
        </QuietLine>
      )}
    </Plain>
  );
}

/** The page without a market to show: the same bar with a plain title, and what is true instead. */
function Plain({ title, children }: { title: string; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader>
        <PageTitle>{title}</PageTitle>
      </PageHeader>
      <Screen>{children}</Screen>
    </View>
  );
}

function EngineMarketDetail({ meta }: { meta: EngineMarket }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const line = useMarketLine(meta.id, meta.symbol);
  const refreshControl = usePullRefresh();
  const [tab, setTab] = useState<DetailTab>("about");
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
            actions={<MarketActions symbol={meta.symbol} name={meta.name} />}
            compact={known ? <CompactPrice line={known} /> : null}
          />
        }
      >
        <MarketIdentity marketId={meta.id} symbol={meta.symbol} name={meta.name} maxLeverageX={known?.maxLeverageX} />
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
      <SideBar symbol={meta.symbol} />
    </View>
  );
}

function Body({ line, tab, onTab }: { line: MarketLine; tab: DetailTab; onTab: (next: DetailTab) => void }) {
  return (
    <>
      <PriceBlock line={line} />
      <ProtocolBanner />
      <HolidayBanner calendarId={line.market.calendarId} name={line.name} />
      <MarketChart line={line} />
      <View style={styles.tabs}>
        <UnderlineTabs options={TABS} value={tab} onChange={onTab} label={`${line.name} details`} />
        <Animated.View key={tab} entering={FadeIn.duration(TIMING.selection)}>
          {tab === "about" ? <MarketAbout line={line} /> : <MarketFeed marketId={line.marketId} name={line.name} />}
        </Animated.View>
      </View>
    </>
  );
}

/**
 * The bar's right side (F32 → F33): the three utilities at rest; once the price block has scrolled away they fade out
 * and the compact price fades in over them, so the price never leaves the screen. The utilities return at the top.
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

/**
 * Sticky Short / Long (F32/F35): two rounded rectangles in the direction fills (12 pt corners, never pills); each
 * opens the ticket on its side, and the ticket names any blocker in place.
 */
function SideBar({ symbol }: { symbol: string }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const open = (side: TicketSide) => {
    fire("press");
    router.push(ticketRoute(symbol, side));
  };
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + SPACE.sm, backgroundColor: color.ground }]}>
      <SideButton side="short" symbol={symbol} onPress={() => open("short")} />
      <SideButton side="long" symbol={symbol} onPress={() => open("long")} />
    </View>
  );
}

function SideButton({ side, symbol, onPress }: { side: TicketSide; symbol: string; onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  const long = side === "long";
  const word = long ? "Long" : "Short";
  return (
    <Animated.View style={[styles.flex, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${word} ${symbol}`}
        accessibilityHint="Opens the order ticket"
        style={({ pressed }) => [
          styles.side,
          { backgroundColor: long ? color.up : color.down, opacity: pressed ? PRESSED : 1 },
        ]}
      >
        <Text style={[TYPE.buttonLabel, { color: long ? color.upForeground : color.downForeground }]}>{word}</Text>
      </Pressable>
    </Animated.View>
  );
}

const PRESSED = 0.85;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  tabs: { gap: SPACE.lg },
  compact: { position: "absolute", top: 0, bottom: 0, right: 0, justifyContent: "center" },
  bar: { flexDirection: "row", gap: SPACE.md, paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm },
  flex: { flex: 1 },
  side: {
    height: SIZE.buttonHeight,
    borderRadius: BUTTON.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
