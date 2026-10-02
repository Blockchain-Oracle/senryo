import { engineMarket } from "@senryo/config";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { usePressScale } from "~/components/kit/usePressScale";
import { engineMarketIndex, indexedMarketMark } from "~/features/portfolio/market-id";
import { fire } from "~/feedback/fire";
import { price18, priceDecimalsOf } from "~/lib/money";
import { useNetwork } from "~/lib/network";
import { BUTTON, CONTROL_FONT_SCALE, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";

/** A page-wide row barely moves under the finger (the same reason as a sheet row). */
const ROW_PRESS_SCALE = 0.985;

/**
 * One TP/SL level (flow book C8; Fomo F11 row grammar): the market's own mark, which level on which market ("Stop
 * loss · XAU short"), one short line (whole position · expires 30 Oct, or what became of it), and the level's price
 * at the right. `trailing` replaces the price column's second line (a Remove on an orphan).
 */
export function OrderRow({
  marketId,
  takeProfit,
  price,
  title,
  detail,
  detailTone,
  trailing,
  onPress,
  index = 0,
}: {
  /** The indexer's market id ("ours-0"). */
  marketId: string;
  takeProfit: boolean;
  price: bigint;
  /** What follows the level's name: "XAU short", "XAU". */
  title: string;
  detail: string;
  detailTone?: string | undefined;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Position in the list, for the once-per-mount stagger. */
  index?: number;
}) {
  const network = useNetwork();
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  const engine = engineMarketIndex(marketId);
  const symbol = engine === undefined ? marketId : (engineMarket(engine)?.symbol ?? marketId);
  const leg = takeProfit ? "Take profit" : "Stop loss";
  const shown = `$${price18(price, engine === undefined ? undefined : priceDecimalsOf(engine))}`;
  return (
    <Animated.View
      entering={FadeInDown.duration(TIMING.staggerItem)
        .delay(index * TIMING.stagger)
        .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] })}
    >
      <Animated.View style={press.style}>
        <Pressable
          disabled={!onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("tick");
            onPress?.();
          }}
          accessibilityRole={onPress ? "button" : "text"}
          accessibilityLabel={`${leg}, ${title}, ${shown}, ${detail}`}
          style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
        >
          <EntityMark
            id={indexedMarketMark(network.chainId, marketId)}
            size={SIZE.avatarMd}
            label={symbol}
            decorative
          />
          <View style={styles.name}>
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              style={[TYPE.rowTitle, { color: color.ink }]}
              numberOfLines={1}
            >
              <Text style={{ color: takeProfit ? color.up : color.down }}>{leg}</Text> · {title}
            </Text>
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              style={[TYPE.rowDetail, { color: detailTone ?? color.text3 }]}
              numberOfLines={1}
            >
              {detail}
            </Text>
          </View>
          <View style={styles.level}>
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              style={[TYPE.rowPrice, { color: color.ink }]}
              numberOfLines={1}
            >
              {shown}
            </Text>
            {trailing}
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
