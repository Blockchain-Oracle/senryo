/**
 * Margin use as a quiet stat cell (S1b.11; it replaces the D2 half gauge): the label over the percent, with a thin
 * meter under it. Value = maintenance margin ÷ liquidation equity (10 000 bps = liquidation), banded up / warn / down;
 * the percent carries the band's colour and the number, so colour is never the only signal, and VoiceOver reads the
 * same sentence.
 */
import { StyleSheet, Text, View } from "react-native";
import { pct } from "~/lib/money";
import { CONTROL_FONT_SCALE, type Palette, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const BPS = 10_000n;
/** The meter is a hairline of emphasis under the number, not a chart. */
const METER_HEIGHT = 4;
/** Bands (bps of margin use): calm below, caution between, danger above. */
export const GAUGE_WARN_BPS = 5_000n;
export const GAUGE_DANGER_BPS = 8_000n;

export function gaugeTone(bps: bigint, color: Palette): string {
  if (bps >= GAUGE_DANGER_BPS) return color.down;
  if (bps >= GAUGE_WARN_BPS) return color.warn;
  return color.up;
}

export function MarginGauge({ usageBps, label = "Margin use" }: { usageBps: bigint; label?: string }) {
  const { color } = useTheme();
  const clamped = usageBps < 0n ? 0n : usageBps > BPS ? BPS : usageBps;
  const tone = gaugeTone(clamped, color);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} ${pct(clamped)}; liquidation at 100 percent`}
      style={styles.cell}
    >
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.meta, { color: color.text3 }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowAmount, { color: tone }]}>
        {pct(clamped)}
      </Text>
      <View style={[styles.track, { backgroundColor: color.muted }]}>
        <View style={{ flex: Number(clamped), backgroundColor: tone }} />
        <View style={{ flex: Number(BPS - clamped) }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { gap: SPACE.xxs },
  track: {
    flexDirection: "row",
    height: METER_HEIGHT,
    borderRadius: RADIUS.pill,
    overflow: "hidden",
    marginTop: SPACE.xs,
  },
});
