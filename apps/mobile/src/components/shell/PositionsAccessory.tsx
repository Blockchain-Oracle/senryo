import { router } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Pressable, StyleSheet, Text } from "react-native";
import type { PositionsSummary } from "~/features/portfolio/usePositionsSummary";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { pct, signedUsd } from "~/lib/money";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The BottomAccessory mini-bar (spec: "2 POS · +$115.80 · XAU LIQ 12% AWAY"): open positions at a glance, closest
 * liquidation first, from the chain (usePositionsSummary). Two instances render (regular + inline), so the summary
 * comes in as a prop and the bar holds no state; the inline placement drops the liquidation part.
 */
export function PositionsAccessory({ summary }: { summary: PositionsSummary }) {
  const { color } = useTheme();
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const pnlColor = summary.upnlUsd6 < 0n ? color.down : color.up;
  const n = summary.nearest;
  const liq = n ? ` · ${n.symbol} LIQ ${n.distanceBps <= 0n ? "NOW" : `${pct(n.distanceBps)} AWAY`}` : "";
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.navigate(ROUTES.portfolio);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${summary.count} open ${summary.count === 1 ? "position" : "positions"}, ${summary.upnlUsd6 < 0n ? "loss" : "profit"} ${signedUsd(summary.upnlUsd6)}${liq}`}
      style={styles.bar}
    >
      <Text style={[TYPE.numSm, { color: color.ink }]} numberOfLines={1}>
        {summary.count} POS · <Text style={{ color: pnlColor }}>{signedUsd(summary.upnlUsd6)}</Text>
        {placement === "inline" ? "" : <Text style={{ color: color.warn }}>{liq}</Text>}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, justifyContent: "center", paddingHorizontal: SPACE.lg, minHeight: SIZE.touch },
});
