import type { LiveMarket } from "@senryo/query";
import { StyleSheet, Text, View } from "react-native";
import { DEV_WORKSPACE } from "~/lib/dev/config";
import { SPACE, TYPE, useTheme } from "~/theme";
import { ageLabel, STATUS_LABEL } from "./session";
import { useNowSec } from "./useNowSec";

/** Source age keeps advancing even when no new round arrives. Polling is never called a live stream. */
export function PriceFreshness({ market }: { market: LiveMarket }) {
  const { color } = useTheme();
  const now = useNowSec();
  const open = market.pv.status === "OPEN";
  const source = DEV_WORKSPACE ? "Local fork" : "Oracle";
  const state = open ? "" : ` · ${STATUS_LABEL[market.pv.status]}`;
  const label = `${source}${state} · updated ${ageLabel(market.updatedAt, now)}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: open ? color.up : color.warn }]} />
      <Text style={[TYPE.meta, styles.text, { color: open ? color.text3 : color.warn }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { flexShrink: 1 },
});
