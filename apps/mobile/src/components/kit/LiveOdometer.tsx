/**
 * A live money figure that rolls its digits (`odometer.ts`) without rendering React: the text arrives through a shared
 * value (`{ text, trend }` — trend gives the roll direction), a frame callback rolls it on the UI thread, and a Skia
 * picture draws it. For the cash-out value, the balance and anything else that moves with ticks.
 */
import { Canvas, Picture, type SkFont, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { type SharedValue, useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { drawOdometer, emptyOdometer, odometerWidth, setOdometerTrend, stepOdometer } from "./odometer";

/** A figure's text and which way it just moved (−1, 0, 1; money compares as bigints on the JS thread). */
export interface LiveFigure {
  text: string;
  trend: number;
}

const HALF = 2;
const PITCH_SHARE = 0.9;

export function LiveOdometer({
  source,
  font,
  color,
  height,
  align = "left",
  accessibilityLabel,
}: {
  source: SharedValue<LiveFigure>;
  font: SkFont | null;
  color: string;
  height: number;
  align?: "left" | "right";
  accessibilityLabel?: string;
}) {
  const odo = useSharedValue(emptyOdometer());
  const clock = useSharedValue(0);
  const last = useSharedValue(0);
  const width = useSharedValue(0);
  const recorder = useMemo(() => Skia.PictureRecorder(), []);
  const paint = useMemo(() => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color(color));
    return p;
  }, [color]);

  useFrameCallback((frame) => {
    "worklet";
    const dt = last.value === 0 ? 0 : frame.timestamp - last.value;
    last.value = frame.timestamp;
    let moving = false;
    odo.modify((o) => {
      "worklet";
      const s = source.value;
      setOdometerTrend(o, s.text, s.trend);
      moving = stepOdometer(o, dt);
      return o;
    });
    if (moving || clock.value === 0) clock.value = frame.timestamp;
  });

  const picture = useDerivedValue(() => {
    "worklet";
    const w = width.value;
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, w, height));
    if (font && w > 0 && clock.value >= 0) {
      const o = odo.value;
      const right = align === "right" ? w : odometerWidth(o, font);
      drawOdometer(canvas, o, font, paint, right, height / HALF, height * PITCH_SHARE, 0, height);
    }
    return recorder.finishRecordingAsPicture();
  });

  return (
    <View
      style={[styles.box, { height }]}
      onLayout={(e: LayoutChangeEvent) => {
        width.value = e.nativeEvent.layout.width;
      }}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignSelf: "stretch" } });
