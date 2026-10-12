/**
 * "↑ +2.34%" (D-319, F7): the 24-hour change against the price 24 hours ago on a tinted plate in the direction's
 * colour (no border, D-196), grey when level — the web's `ChangeChip`. The live price is sampled once a second.
 */
import { type DayLine, dayChange } from "@senryo/calls";
import { useSampledPrice } from "@senryo/live/react";
import { StyleSheet, Text, View } from "react-native";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const TAIL_MS = 1_000;
const CHIP_H = 22;

export function ChangeChip({ symbol, day }: { symbol: string; day: DayLine }) {
  const { color } = useTheme();
  const nowE8 = useSampledPrice(symbol, TAIL_MS);
  if (nowE8 === undefined) return null;
  const c = dayChange(day.openE8, nowE8);
  const plate = c.tone === "up" ? color.upSurface : c.tone === "down" ? color.downSurface : color.muted;
  const ink = c.tone === "up" ? color.up : c.tone === "down" ? color.down : color.inkMuted;
  return (
    <View style={[styles.chip, { backgroundColor: plate }]}>
      <Text style={[TYPE.micro, styles.figure, { color: ink }]}>{c.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: CHIP_H, paddingHorizontal: SPACE.xs, borderRadius: RADIUS.xs, justifyContent: "center" },
  figure: { fontVariant: ["tabular-nums"], fontWeight: "600" },
});
