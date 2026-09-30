import { router } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Pressable, StyleSheet, Text } from "react-native";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { pct, signedUsd } from "~/lib/money";
import { SAMPLE_POSITIONS } from "~/lib/sample";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The BottomAccessory mini-bar (spec: "2 POS · +$115.80 · XAU LIQ 12% AWAY"): open positions at a glance, closest
 * liquidation first. Preview data until S8. Two instances render (regular + inline), so it holds no state.
 */
export function PositionsAccessory() {
  const { color } = useTheme();
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const total = SAMPLE_POSITIONS.reduce((sum, p) => sum + p.pnl6, 0n);
  const nearest = [...SAMPLE_POSITIONS].sort((a, b) => (a.liqDistanceBps < b.liqDistanceBps ? -1 : 1))[0];
  const pnlColor = total < 0n ? color.down : color.up;
  const liq = nearest ? ` · ${nearest.market} LIQ ${pct(nearest.liqDistanceBps)} AWAY` : "";
  const label = `${SAMPLE_POSITIONS.length} POS · `;
  return (
    <Pressable
      onPress={() => {
        fire("tick");
        router.navigate(ROUTES.portfolio);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${SAMPLE_POSITIONS.length} open positions, profit ${signedUsd(total)}${liq}. Preview data.`}
      style={styles.bar}
    >
      <Text style={[TYPE.numSm, { color: color.ink }]} numberOfLines={1}>
        {label}
        <Text style={{ color: pnlColor }}>{signedUsd(total)}</Text>
        {placement === "inline" ? "" : <Text style={{ color: color.warn }}>{liq}</Text>}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, justifyContent: "center", paddingHorizontal: SPACE.lg, minHeight: SIZE.touch },
});
