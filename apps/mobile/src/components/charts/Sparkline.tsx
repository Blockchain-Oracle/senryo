import { useMemo } from "react";
import Svg, { Polyline } from "react-native-svg";
import { SIZE } from "~/theme";
import { CHART } from "./constants";

/** Static SVG sparkline for watchlist rows (spec: "static SVG sparkline"; no animated props, so no Fabric repaint issue). */
export function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const points = useMemo(() => {
    if (values.length < CHART.minPoints) return "";
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const dx = SIZE.sparklineWidth / (values.length - 1);
    return values.map((v, i) => `${i * dx},${SIZE.sparkline - ((v - lo) / span) * SIZE.sparkline}`).join(" ");
  }, [values]);
  return (
    <Svg width={SIZE.sparklineWidth} height={SIZE.sparkline} accessibilityElementsHidden>
      <Polyline points={points} fill="none" stroke={stroke} strokeWidth={CHART.stroke} />
    </Svg>
  );
}
