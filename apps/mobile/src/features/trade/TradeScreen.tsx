import { engineMarket } from "@senryo/config";
import { DECIMALS } from "@senryo/core";
import { useCandles } from "@senryo/query";
import { router, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CandleChart } from "~/components/charts/CandleChart";
import { Screen } from "~/components/kit/Screen";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { usePressScale } from "~/components/kit/usePressScale";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { HolidayBanner, ProtocolBanner } from "~/features/markets/MarketBanners";
import { useMarketLine } from "~/features/markets/useMarketLine";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { fire } from "~/feedback/fire";
import { type TicketSide, ticketRoute } from "~/lib/constants/routes";
import { useReadOnlyNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useCandleStyle } from "./candle-style";
import { TradeHeader } from "./TradeHeader";

/** 15-minute candles: ~3 days of Chainlink rounds on a phone-width chart. */
const CHART_INTERVAL = 900;
const MS_PER_SECOND = 1000;

/**
 * Market detail (`/markets/[market]`, the old Trade tab; J3 completes it in S1b.9): identity + venue → price, change
 * and freshness → candles → sticky Short / Long (Fomo F32/F35). Like Fomo's detail it hides the dock: the bottom zone
 * belongs to Short / Long, which open the order ticket on that side over this page (M13 → C39). Dismissing the ticket
 * restores this page with its scroll (FT112).
 */
export function TradeScreen({ marketId }: { marketId: string }) {
  const meta = engineMarket(marketId);
  const readOnly = useReadOnlyNetwork();
  useHideDockWhileFocused("market-detail");
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <Screen>
        {readOnly ? (
          <PrelaunchMainnet surface="trade" />
        ) : meta ? (
          <EngineMarket marketId={meta.id} symbol={meta.symbol} />
        ) : (
          <EmptyState
            why={`${marketId} isn't tradable here yet`}
            detail="Gold, silver and FX trade now on Senryo's engine; crypto on Perpl arrives next."
          />
        )}
      </Screen>
      {meta && !readOnly ? <SideBar symbol={meta.symbol} /> : null}
    </>
  );
}

function EngineMarket({ marketId, symbol }: { marketId: number; symbol: string }) {
  const { color } = useTheme();
  const line = useMarketLine(marketId, symbol);
  const candles = useCandles(symbol, CHART_INTERVAL);
  const style = useCandleStyle();
  return (
    <ReadingView reading={line} loading="line" loadingLabel="Reading the oracle">
      {(l) => (
        <>
          <TradeHeader line={l} />
          <ProtocolBanner />
          <HolidayBanner calendarId={l.market.calendarId} name={l.name} />
          <ReadingView reading={candles} loading="chart" loadingLabel="Loading Chainlink rounds">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState why="No rounds in this window yet" detail="The chart fills as Chainlink publishes." />
              ) : (
                <CandleChart
                  decimals={DECIMALS.e18}
                  style={style}
                  candles={rows.map((c) => ({
                    t: c.openTime * MS_PER_SECOND,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                  }))}
                />
              )
            }
          </ReadingView>
          <Text style={[TYPE.meta, { color: color.text3 }]}>Chainlink {symbol}/USD · Monad · 15m candles</Text>
        </>
      )}
    </ReadingView>
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
  bar: { flexDirection: "row", gap: SPACE.md, paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm },
  flex: { flex: 1 },
  side: {
    height: SIZE.buttonHeight,
    borderRadius: BUTTON.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
