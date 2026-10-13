/**
 * A price's 24-hour graph on the phone (D-319, F7): the web's passive sparkline (21st #30538 via Mitoshi) as a Skia
 * path — the shared `@senryo/calls` `sparkGeometry` (gaps stay gaps; the live price closes it), a faint fill under
 * the line, a dashed baseline at the price 24 hours ago, the line in the direction ink (D-316). The live tail redraws
 * once a second.
 */
import { type DayLine, sparkGeometry } from "@senryo/calls";
import { useSampledPrice } from "@senryo/live/react";
import { Canvas, DashPathEffect, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { SIZE, useTheme } from "~/theme";
import { withAlpha } from "~/theme/palette";

const PAD = 2;
const STROKE = 1.6;
const TAIL_MS = 1_000;
const FILL_ALPHA = 0.08;
const BASE_ALPHA = 0.5;
const DASH_ON = 2;
const DASH_OFF = 3;
const DASH = [DASH_ON, DASH_OFF];

export function Sparkline({
  symbol,
  day,
  width = SIZE.sparklineWidth,
  height = SIZE.sparkline,
}: {
  symbol: string;
  day: DayLine;
  /** Search's rows draw it smaller (56 × 20, Codex direction 13). */
  width?: number;
  height?: number;
}) {
  const { color } = useTheme();
  const nowE8 = useSampledPrice(symbol, TAIL_MS);
  const w = width;
  const h = height;
  const g = useMemo(() => sparkGeometry(day, nowE8, w, h, PAD), [day, nowE8, w, h]);
  const paths = useMemo(
    () => (g ? { line: Skia.Path.MakeFromSVGString(g.d), area: Skia.Path.MakeFromSVGString(g.area) } : null),
    [g],
  );
  if (!g || !paths?.line || !paths.area) return null;
  const hue = g.tone === "up" ? color.up : g.tone === "down" ? color.down : color.text3;
  return (
    <Canvas style={{ width: w, height: h }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path path={paths.area} color={withAlpha(hue, FILL_ALPHA)} />
      <Line p1={vec(0, g.baseY)} p2={vec(w, g.baseY)} color={withAlpha(color.text3, BASE_ALPHA)} strokeWidth={1}>
        <DashPathEffect intervals={DASH} />
      </Line>
      <Path path={paths.line} color={hue} style="stroke" strokeWidth={STROKE} strokeCap="round" strokeJoin="round" />
    </Canvas>
  );
}
