/**
 * Tradash's "View position" pill on the phone terminal (R5.3): "View position" / "View N positions" with the total
 * ROI and an arrow by its sign; opens the positions sheet. A trade on its way, or one that just ended, stands in its
 * place as a small paper (`CompactTrade`, R5.11). Nothing while nothing is open.
 */
import { useLiveBook, useTradeRuns } from "@senryo/calls/react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { Plunge, Surge } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { CompactTrade } from "~/features/receipts/CompactTrade";
import { fire } from "~/feedback/fire";
import { masked, useHideBalances } from "~/lib/hide-balances";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const BPS_PER_PERCENT = 100;
const PCT_DECIMALS = 1;

export function ViewPositionPill({ onOpen }: { onOpen: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  const { totals, entries } = useLiveBook();
  const [hidden] = useHideBalances();
  const runs = useTradeRuns((instrument, id) => entries.some((e) => e.kind === instrument && e.id === id));
  const pending = runs.pending[0];
  const finished = runs.focused ?? undefined;
  if (pending || finished) return <CompactTrade pending={pending} finished={finished} onOpen={onOpen} />;
  if (totals.count === 0) return null;
  const roi = totals.roiBps;
  const down = roi !== null && roi < 0;
  const Icon = down ? Plunge : Surge;
  const label = totals.count === 1 ? "View position" : `View ${totals.count} positions`;
  const pct =
    roi === null ? "" : masked(`${down ? "−" : "+"}${Math.abs(roi / BPS_PER_PERCENT).toFixed(PCT_DECIMALS)}%`, hidden);
  return (
    <Animated.View style={[styles.wrap, press.style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${pct ? `, ${pct}` : ""}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          fire("tick");
          onOpen();
        }}
        style={[styles.pill, { backgroundColor: color.raised2 }]}
      >
        <Icon size={SIZE.iconSm} color={down ? color.down : color.up} />
        <Text style={[TYPE.chipCategory, { color: color.ink }]}>{label}</Text>
        {pct ? <Text style={[TYPE.rowChange, { color: down ? color.down : color.up }]}>{pct}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: SIZE.chipHeight + SPACE.xs,
    paddingHorizontal: SPACE.lg,
    borderRadius: (SIZE.chipHeight + SPACE.xs) / 2,
  },
});
