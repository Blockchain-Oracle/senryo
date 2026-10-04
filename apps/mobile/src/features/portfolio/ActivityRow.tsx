import { collateralId } from "@senryo/identity";
import type { IndexedActivity } from "@senryo/indexer-client";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { ArrowLeftRight, ChartCandlestick, CreditCard } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { indexedReceiptRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { BUTTON, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { activityFigure, activityNote, activityTime, activityTitle, groupOf } from "./activity-copy";
import { indexedMarketMark } from "./market-id";

/** A page-wide row barely moves under the finger (the same reason as a sheet row). */
const ROW_PRESS_SCALE = 0.985;

const GROUP_ICON = { trades: ChartCandlestick, money: ArrowLeftRight, card: CreditCard } as const;

/** The row's 48 pt lead: the market's or the token's own mark when the event names one, else its kind's glyph on a quiet disc. */
function Lead({ row }: { row: IndexedActivity }) {
  const network = useNetwork();
  const { color } = useTheme();
  const market = row.market ? indexedMarketMark(network.chainId, row.market.id) : undefined;
  if (market) return <EntityMark id={market} size={SIZE.markDetail} label={row.market?.symbol} decorative />;
  if (row.symbol === "AUSD" || row.symbol === "USDC") {
    return <EntityMark id={collateralId(network.chainId, row.symbol)} size={SIZE.markDetail} decorative />;
  }
  const Glyph = GROUP_ICON[groupOf(row.kind)];
  return (
    <View style={[styles.disc, { backgroundColor: color.card }]}>
      <Glyph size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text2} />
    </View>
  );
}

/**
 * One activity row in the market-row anatomy (Fomo F12; Activity history in the screen inventory): bare on the page,
 * a 48 pt lead, what happened over when, and at the right the figure the event carries — a signed change in its
 * colour, a realised result, or a plain size — over what that figure is. It opens the receipt drawer; the explorer is a secondary action.
 */
export function ActivityRow({ row }: { row: IndexedActivity }) {
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  const title = activityTitle(row);
  const figure = activityFigure(row);
  const note = activityNote(row);
  const when = activityTime(row.timestamp);
  const tone = figure?.tone === "up" ? color.up : figure?.tone === "down" ? color.down : color.ink;
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          router.push(indexedReceiptRoute(row.id));
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${when}${figure ? `, ${figure.text}` : ""}${note ? `, ${note}` : ""}`}
        accessibilityHint="Opens transaction details and receipt"
        style={({ pressed }) => [styles.row, pressed ? { backgroundColor: color.card } : null]}
      >
        <Lead row={row} />
        <View style={styles.name}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[TYPE.rowDetail, { color: color.text3 }]} numberOfLines={1}>
            {when}
          </Text>
        </View>
        {figure || note ? (
          <View style={styles.figure}>
            {figure ? (
              <Text style={[TYPE.rowPrice, { color: tone }]} numberOfLines={1}>
                {figure.text}
              </Text>
            ) : null}
            {note ? (
              <Text style={[TYPE.rowChange, { color: color.text3 }]} numberOfLines={1}>
                {note}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
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
  disc: {
    width: SIZE.markDetail,
    height: SIZE.markDetail,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, gap: SPACE.xxs },
  figure: { alignItems: "flex-end", gap: SPACE.xxs },
});
