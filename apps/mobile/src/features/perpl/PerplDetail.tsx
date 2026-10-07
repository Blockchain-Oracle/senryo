import { formatUnits } from "@senryo/core";
import { useDiscoveryCandles, useDiscoveryQuote, usePerplExchange, usePerplMarketTerms } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HistoryChart } from "~/components/charts/HistoryChart";
import { ReadingView } from "~/components/kit/states";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { ChildSheet } from "~/components/sheet/ChildSheet";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { MarketActions, marketShareUrl } from "~/features/markets/MarketActions";
import { Wash } from "~/features/markets/MarketBanners";
import { MarketFeed } from "~/features/markets/MarketFeed";
import { PageHeader } from "~/features/markets/PageHeader";
import { DEFAULT_PERIOD, type PeriodKey, periodOf } from "~/features/markets/periods";
import { compactUsd6, tokenPrice } from "~/features/tokens/format";
import { LockedBar, SideBar } from "~/features/trade/SideBar";
import { Change, MarketIdentity } from "~/features/trade/TradeHeader";
import { DEV_WORKSPACE } from "~/lib/dev/config";
import { clockTime } from "~/lib/format";
import { CONTROL_FONT_SCALE, HERO_FONT_SCALE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { leverageX } from "./format";
import { type PerplMarketMeta, perplWatchKey } from "./market";
import { PerplAbout } from "./PerplAbout";
import { PerplHeldRow, PerplOwnRow } from "./PerplLinks";
import { PerplLiveChart } from "./PerplLiveChart";
import { usePerplAccess } from "./usePerplAccess";

const MS_PER_SECOND = 1000;
const E18 = 18;

/** Market activity and opted-in Senryo posts, then market facts. Perpl has no holders list we can read. */
const TABS = [
  { value: "feed", label: "Feed" },
  { value: "about", label: "About" },
] as const;
type DetailTab = (typeof TABS)[number]["value"];

/**
 * A Perpl market's page (flow book C2 for C4 markets; Fomo F32 anatomy): mark with Perpl's badge, ticker, the max
 * leverage read live and the venue in the bar with Watch · Share → Perpl's mark price with its 24 h change and open
 * interest → Perpl's candles with the period chips → "Your position ›" and "Own BTC ›" → Feed (public fills on this
 * market) · About → a state line when Perpl pauses → sticky Short / Long into the Perpl ticket. Perpl's restricted
 * regions see it read-only.
 */
export function PerplDetail({ meta }: { meta: PerplMarketMeta }) {
  useHideDockWhileFocused("perpl-detail");
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const access = usePerplAccess();
  const id = perplWatchKey(meta.symbol);
  const quote = useDiscoveryQuote(id);
  const termsReading = usePerplMarketTerms(meta.marketId);
  const terms = termsReading.status === "fresh" || termsReading.status === "stale" ? termsReading.value : undefined;
  const exchange = usePerplExchange();
  const halted = (exchange.status === "fresh" || exchange.status === "stale") && exchange.value.halted;
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const [tab, setTab] = useState<DetailTab>(access.state === "trade" ? "feed" : "about");
  const [why, setWhy] = useState(false);
  const candles = useDiscoveryCandles(id, periodOf(period).interval, !DEV_WORKSPACE);
  const known = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  const mainnet = access.state === "trade" || access.word !== "Mainnet";
  const tabs = mainnet ? TABS : TABS.filter((t) => t.value === "about");
  const shown = mainnet ? tab : "about";
  const banner = halted ? (
    <Wash tone="down" text="Perpl paused · closing may wait" />
  ) : terms?.paused ? (
    <Wash tone="warn" text={`${meta.symbol} paused on Perpl`} />
  ) : null;
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader right={<MarketActions name={meta.symbol} watchKey={id} shareUrl={marketShareUrl(meta.symbol)} />}>
        <MarketIdentity
          mark={meta.mark}
          venueMark={meta.venueMark}
          symbol={meta.symbol}
          name={meta.name}
          maxLeverageX={terms ? leverageX(terms.maxLeverageHdths) : undefined}
          venue="Perpl"
        />
      </PageHeader>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}>
        <ReadingView
          reading={quote}
          loading="line"
          loadingLabel="Reading Perpl’s mark"
          retry={() => void client.invalidateQueries({ queryKey: ["discovery"] })}
        >
          {(q) => (
            <View style={styles.block}>
              <View style={styles.flex}>
                <Text
                  maxFontSizeMultiplier={HERO_FONT_SCALE}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  accessibilityRole="header"
                  style={[TYPE.displayPrice, { color: color.ink }]}
                >
                  {tokenPrice(q.price18)}
                </Text>
                <Change bps={q.change24h.available ? q.change24h.value.bps : undefined} suffix />
                <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
                  Perpl mark · {clockTime(q.updatedAt * MS_PER_SECOND)}
                </Text>
              </View>
              {q.openInterest.available ? (
                <View
                  style={styles.oi}
                  accessible
                  accessibilityLabel={`Open interest ${compactUsd6(q.openInterest.value.usd6)} a side`}
                >
                  <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowPrice, { color: color.ink }]}>
                    {compactUsd6(q.openInterest.value.usd6)}
                  </Text>
                  <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text3 }]}>
                    Open interest
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </ReadingView>
        <PerplLiveChart
          marketId={meta.marketId}
          history={
            <HistoryChart
              reading={candles}
              period={period}
              onPeriod={setPeriod}
              priceUsd18={known?.price18}
              caption={`${meta.symbol}/USD`}
              loadingLabel="Loading its history"
              retry={() => void client.invalidateQueries({ queryKey: ["discovery"] })}
            />
          }
        />
        <View style={styles.links}>
          {mainnet ? <PerplHeldRow meta={meta} /> : null}
          <PerplOwnRow meta={meta} />
        </View>
        <View style={styles.tabs}>
          {tabs.length > 1 ? (
            <UnderlineTabs options={tabs} value={shown} onChange={setTab} label={`${meta.name} details`} />
          ) : null}
          <Animated.View key={shown} entering={FadeIn.duration(TIMING.selection)}>
            {shown === "feed" ? (
              <MarketFeed
                marketId={meta.marketId}
                name={meta.symbol}
                symbol={meta.symbol}
                format={{
                  id: `perpl-${meta.marketId}`,
                  priceDecimals: meta.priceDecimals,
                  size: (size18) => `${formatUnits(size18, E18, meta.lotDecimals)} ${meta.symbol}`,
                }}
              />
            ) : (
              <PerplAbout meta={meta} terms={terms} quote={known} />
            )}
          </Animated.View>
        </View>
      </ScrollView>
      {access.state === "trade" ? (
        <SideBar symbol={meta.symbol} status={undefined} calendarId={0} banners={banner} />
      ) : (
        <LockedBar word={access.word} onInfo={() => setWhy(true)} />
      )}
      {access.state === "locked" ? (
        <ChildSheet open={why} onClose={() => setWhy(false)} title={access.title}>
          <Text style={[TYPE.body, { color: color.text2 }]}>{access.reason}</Text>
        </ChildSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.xl },
  block: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md },
  flex: { flex: 1, gap: SPACE.xxs },
  oi: { alignItems: "flex-end", gap: SPACE.xxs, paddingTop: SPACE.sm },
  links: { gap: SPACE.xxs },
  tabs: { gap: SPACE.lg },
});
