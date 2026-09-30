/**
 * Margin gauge — RN port of 21st designali-in/gauge-1 (#3719), the D2 half gauge (web twin:
 * apps/web/src/components/ui/gauge/{arc,index}.tsx; same true-semicircle geometry). Value = maintenance margin ÷
 * liquidation equity after the trade (10 000 bps = liquidation), banded --up / --warn / --down; the centre shows the
 * percent and the label, and VoiceOver reads the same sentence.
 */
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { pct } from "~/lib/money";
import { type Palette, SPACE, TYPE, useTheme } from "~/theme";

const BOX = 100;
const CENTER = 50;
const RADIUS_UNITS = 42;
const STROKE = 8;
const HALF_BOX_H = 56;
const START_DEG = 180;
const SWEEP_DEG = 180;
const DEG = Math.PI / SWEEP_DEG;
const BPS = 10_000;
/** Bands (bps of margin use): calm below, caution between, danger above. */
export const GAUGE_WARN_BPS = 5_000n;
export const GAUGE_DANGER_BPS = 8_000n;
const GAP_DEG = 4;

const point = (deg: number) => ({
  x: CENTER + RADIUS_UNITS * Math.cos(deg * DEG),
  y: CENTER + RADIUS_UNITS * Math.sin(deg * DEG),
});

function arc(a0: number, a1: number): string {
  if (a1 - a0 <= 0) return "";
  const p0 = point(a0);
  const p1 = point(a1);
  return `M ${p0.x} ${p0.y} A ${RADIUS_UNITS} ${RADIUS_UNITS} 0 0 1 ${p1.x} ${p1.y}`;
}

export function gaugeTone(bps: bigint, color: Palette): string {
  if (bps >= GAUGE_DANGER_BPS) return color.down;
  if (bps >= GAUGE_WARN_BPS) return color.warn;
  return color.up;
}

export function MarginGauge({
  usageBps,
  width,
  label = "MARGIN USE",
}: {
  usageBps: bigint;
  width: number;
  label?: string;
}) {
  const { color } = useTheme();
  const clamped = usageBps < 0n ? 0n : usageBps > BigInt(BPS) ? BigInt(BPS) : usageBps;
  const at = START_DEG + (Number(clamped) / BPS) * SWEEP_DEG;
  const end = START_DEG + SWEEP_DEG;
  const tone = gaugeTone(clamped, color);
  const primary = arc(START_DEG, Math.min(at, end));
  const secondary = arc(Math.min(at + GAP_DEG, end), end);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label.toLowerCase()} ${pct(clamped)}; liquidation at 100 percent`}
      style={{ width, height: (width * HALF_BOX_H) / BOX }}
    >
      <Svg width={width} height={(width * HALF_BOX_H) / BOX} viewBox={`0 0 ${BOX} ${HALF_BOX_H}`}>
        {secondary ? (
          <Path d={secondary} fill="none" stroke={color.muted} strokeWidth={STROKE} strokeLinecap="round" />
        ) : null}
        {primary ? <Path d={primary} fill="none" stroke={tone} strokeWidth={STROKE} strokeLinecap="round" /> : null}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[TYPE.numMd, { color: color.ink }]}>{pct(clamped)}</Text>
        <Text style={[TYPE.micro, { color: color.inkMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", gap: SPACE.xxs },
});
