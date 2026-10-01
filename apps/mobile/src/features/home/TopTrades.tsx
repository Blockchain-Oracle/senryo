import type { TopTrade } from "@senryo/api-client";
import { shortAddress } from "@senryo/core";
import { useTopTrades } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { EntityMark } from "~/components/identity/EntityMark";
import { useGroupFill } from "~/components/kit/Surface";
import { usePressScale } from "~/components/kit/usePressScale";
import { indexedMarketMark } from "~/features/portfolio/market-id";
import { fire } from "~/feedback/fire";
import { watchRoute } from "~/lib/constants/routes";
import { signedUsd } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import { SectionHeading } from "./HomeParts";

/** F09's card measures about 154 × 89 pt: a person line over a market-and-result line. */
const CARD_WIDTH = 164;

/**
 * Weekly Top Trades (Fomo F09, C23): a row of small filled cards that scrolls off the right edge — who (on a lighter
 * band across the card's top), on which market, and the position's realised result after fees, funding and borrow,
 * signed and coloured. They are this
 * network's verified trades from the api; when it has none (or cannot be reached) the section is simply absent: no
 * sample cards, no empty box. A card opens that account read-only.
 */
export function TopTrades() {
  const trades = useTopTrades();
  const items = trades.status === "fresh" || trades.status === "stale" ? trades.value.items : [];
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeading title="Weekly top trades" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.cards}
      >
        {items.map((trade, i) => (
          <TradeCard key={trade.positionId} trade={trade} index={i} />
        ))}
      </ScrollView>
    </View>
  );
}

function TradeCard({ trade, index }: { trade: TopTrade; index: number }) {
  const network = useNetwork();
  const { color } = useTheme();
  const fill = useGroupFill();
  const press = usePressScale();
  const who = trade.trader.displayName ?? trade.trader.handle ?? shortAddress(trade.trader.address);
  const gain = trade.netPnlUsd6 >= 0n;
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(index * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
    >
      <Animated.View style={press.style}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("tick");
            router.push(watchRoute(trade.trader.address));
          }}
          accessibilityRole="button"
          accessibilityLabel={`Rank ${trade.rank}, ${who}, ${trade.symbol} ${trade.side.toLowerCase()}, ${gain ? "profit" : "loss"} ${signedUsd(trade.netPnlUsd6)}`}
          accessibilityHint="Opens this account, read-only"
          style={({ pressed }) => [styles.card, { backgroundColor: pressed ? color.rowPressed : fill }]}
        >
          <View style={[styles.line, styles.who, { backgroundColor: color.raised2 }]}>
            <Avatar avatar={trade.trader.avatar} address={trade.trader.address} size={SIZE.avatarXs} />
            <Text style={[TYPE.row, styles.shrink, { color: color.ink }]} numberOfLines={1}>
              {who}
            </Text>
          </View>
          <View style={[styles.line, styles.result]}>
            <EntityMark
              id={indexedMarketMark(network.chainId, trade.marketId)}
              size={SIZE.avatarXs}
              label={trade.symbol}
              decorative
              ground={fill}
            />
            <Text
              style={[TYPE.rowPrice, styles.shrink, { color: gain ? color.up : color.down }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {signedUsd(trade.netPnlUsd6)}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.md },
  // The row runs to both screen edges; the first card still starts on the gutter.
  bleed: { marginHorizontal: -SIZE.gutter },
  cards: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter },
  card: { width: CARD_WIDTH, borderRadius: RADIUS.md, overflow: "hidden" },
  line: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingHorizontal: SPACE.md },
  // F09: the person sits on a lighter band (36 pt) across the top of the card, the result on the card itself (52 pt).
  who: { paddingVertical: SPACE.xs + SPACE.xxs },
  result: { paddingVertical: SPACE.md + SPACE.xxs },
  shrink: { flexShrink: 1 },
});
