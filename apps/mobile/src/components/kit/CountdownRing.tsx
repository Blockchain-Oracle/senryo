/**
 * The window's countdown ring (21st.dev #1737 Circle Progress, ported to Skia): the arc empties counter-clockwise from
 * the window's start to the moment calls close, on the server's clock (`offsetMs`), redrawn on the UI thread — no React
 * render per second. The last ten seconds tint it the warning colour.
 */
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

const MS = 1000;
const LAST_SECONDS = 10;
const FULL_TURN = 360;
const START_ANGLE = -90;
const HALF = 2;

export function CountdownRing({
  fromSec,
  toSec,
  offsetMs,
  size = 40,
  stroke = 3,
  color,
  warn,
  track,
}: {
  fromSec: number;
  toSec: number;
  offsetMs: SharedValue<number>;
  size?: number;
  stroke?: number;
  color: string;
  warn: string;
  track: string;
}) {
  const now = useSharedValue(Date.now());
  useFrameCallback(() => {
    "worklet";
    now.value = Date.now() + offsetMs.value;
  });
  const r = (size - stroke) / HALF;
  const rect = useMemo(() => Skia.XYWHRect(stroke / HALF, stroke / HALF, size - stroke, size - stroke), [size, stroke]);
  const circle = useMemo(() => Skia.Path.Circle(size / HALF, size / HALF, r), [size, r]);
  const arc = useDerivedValue(() => {
    const span = Math.max(1, (toSec - fromSec) * MS);
    const left = Math.min(1, Math.max(0, (toSec * MS - now.value) / span));
    return Skia.PathBuilder.Make()
      .addArc(rect, START_ANGLE, -FULL_TURN * left)
      .build();
  });
  const tint = useDerivedValue(() => (toSec * MS - now.value <= LAST_SECONDS * MS ? warn : color));
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={circle} style="stroke" strokeWidth={stroke} color={track} />
      <Path path={arc} style="stroke" strokeWidth={stroke} strokeCap="round" color={tint} />
    </Canvas>
  );
}
