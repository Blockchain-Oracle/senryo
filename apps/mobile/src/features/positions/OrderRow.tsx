import type { PositionView } from "@senryo/chain";
import { engineMarket } from "@senryo/config";
import { durationUntil } from "@senryo/core";
import type { Triggers } from "@senryo/indexer-client";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { usePressScale } from "~/components/kit/usePressScale";
import { engineMarketIndex, indexedMarketMark } from "~/features/portfolio/market-id";
import { fire } from "~/feedback/fire";
import { positionRoute } from "~/lib/constants/routes";
import { price18, priceDecimalsOf } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";

/** A page-wide row barely moves under the finger (the same reason as a sheet row). */
const ROW_PRESS_SCALE = 0.985;
const MS_PER_SECOND = 1000n;

/**
 * One active TP/SL trigger in the market-row anatomy (Fomo F12; Orders / triggers in the screen inventory): the
 * market's own mark, which leg it is and on which market, how much of the position it closes, and at the right the
 * trigger price over when it expires. The row opens the position, where the level can be cancelled or replaced.
 */
export function OrderRow({
  trigger,
  position,
  index = 0,
}: {
  trigger: Triggers[number];
  /** The position it reduces, when it is still open: says whether the trigger closes all of it. */
  position: PositionView | undefined;
  /** Position in the list, for the entrance stagger. */
  index?: number;
}) {
  const network = useNetwork();
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  const marketIndex = engineMarketIndex(trigger.market_id);
  const market = marketIndex === undefined ? undefined : engineMarket(marketIndex);
  const leg = trigger.takeProfit ? "Take profit" : "Stop loss";
  const price = price18(trigger.triggerPrice, marketIndex === undefined ? undefined : priceDecimalsOf(marketIndex));
  const share = position ? (trigger.size >= position.size ? "Closes the whole position" : "Closes part of it") : "";
  const nowSec = BigInt(Date.now()) / MS_PER_SECOND;
  const expires = `expires ${durationUntil(BigInt(trigger.expiry), nowSec)}`;
  const symbol = market?.symbol ?? trigger.market_id;
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(index * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
    >
      <Animated.View style={press.style}>
        <Pressable
          disabled={marketIndex === undefined}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            if (marketIndex === undefined) return;
            fire("tick");
            router.push(positionRoute(String(marketIndex)));
          }}
          accessibilityRole="button"
          accessibilityLabel={`${leg} on ${market?.name ?? symbol} at ${price}${share ? `, ${share.toLowerCase()}` : ""}, ${expires}`}
          accessibilityHint="Opens the position, where you can cancel it"
          style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
        >
          <EntityMark
            id={indexedMarketMark(network.chainId, trigger.market_id)}
            size={SIZE.markDetail}
            label={symbol}
            decorative
          />
          <View style={styles.name}>
            <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={1}>
              <Text style={{ color: trigger.takeProfit ? color.up : color.down }}>{leg}</Text> · {symbol}
            </Text>
            {share ? (
              <Text style={[TYPE.rowDetail, { color: color.text3 }]} numberOfLines={1}>
                {share}
              </Text>
            ) : null}
          </View>
          <View style={styles.level}>
            <Text style={[TYPE.rowPrice, { color: color.ink }]} numberOfLines={1}>
              {price}
            </Text>
            <Text style={[TYPE.rowChange, { color: color.text3 }]} numberOfLines={1}>
              {expires}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    marginHorizontal: -SPACE.sm,
    borderRadius: BUTTON.radius.md,
  },
  name: { flex: 1, gap: SPACE.xxs },
  level: { alignItems: "flex-end", gap: SPACE.xxs },
});
