/**
 * One suggested trader (C11; Fomo F06): rank, avatar, name over @handle, and why they are suggested (their 30-day
 * result, signed, in the mode's money). Tapping selects; a selected row shows a check and a ring-coloured edge — the
 * one place a row carries an edge, because it marks a choice (F06). Selection is a checkbox for VoiceOver.
 */
import type { Address } from "@senryo/account";
import { Check } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Avatar } from "~/components/identity/Avatar";
import { usePressScale } from "~/components/kit/usePressScale";
import { fire } from "~/feedback/fire";
import { signedUsd } from "~/lib/money";
import { BUTTON, HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const ROW_PRESS_SCALE = 0.985;

export interface SuggestedTrader {
  address: Address;
  handle: string | null;
  displayName: string | null;
  avatar: string | null;
  rank: number;
  netPnlUsd6: bigint;
}

export function FollowRow({
  trader,
  selected,
  onToggle,
}: {
  trader: SuggestedTrader;
  selected: boolean;
  onToggle: () => void;
}) {
  const { color } = useTheme();
  const press = usePressScale(ROW_PRESS_SCALE);
  const name = trader.displayName ?? trader.handle ?? "Trader";
  const gain = trader.netPnlUsd6 >= 0n;
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onToggle();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${name}, rank ${trader.rank}, ${gain ? "up" : "down"} ${signedUsd(trader.netPnlUsd6)} over 30 days`}
        style={[styles.row, { backgroundColor: color.card, borderColor: selected ? color.ring : color.transparent }]}
      >
        <Text style={[TYPE.rowChange, styles.rank, { color: color.text3 }]}>{trader.rank}</Text>
        <Avatar avatar={trader.avatar} address={trader.address} />
        <View style={styles.text}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]} numberOfLines={1}>
            {name}
          </Text>
          {trader.handle ? (
            <Text style={[TYPE.rowDetail, { color: color.text3 }]} numberOfLines={1}>
              @{trader.handle}
            </Text>
          ) : null}
        </View>
        {selected ? (
          <Check size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.link} />
        ) : (
          <View style={styles.reason}>
            <Text style={[TYPE.rowPrice, { color: gain ? color.up : color.down }]}>{signedUsd(trader.netPnlUsd6)}</Text>
            <Text style={[TYPE.meta, { color: color.text3 }]}>30 days</Text>
          </View>
        )}
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
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: BUTTON.radius.md + SPACE.xs,
    borderWidth: HAIRLINE_PX,
  },
  rank: { minWidth: SPACE.lg, textAlign: "center" },
  text: { flex: 1, gap: SPACE.xxs },
  reason: { alignItems: "flex-end", gap: SPACE.xxs },
});
