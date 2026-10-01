import { create } from "qrcode";
import { type ReactNode, useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { EASE, RADIUS, SIZE, SPACE, TIMING, useTheme } from "~/theme";

/** The QR spec's quiet zone (modules) — scanners need it light on every side. */
const QUIET_MODULES = 4;
/** A centred mark covers at most this share of the code's width; error correction H recovers what it hides. */
const CENTER_SHARE = 0.22;
/** The code settles from slightly small; the centre mark lands after the modules. */
const REVEAL_FROM_SCALE = 0.94;
const CENTER_DELAY_SHARE = 0.55;

/**
 * A QR code drawn from the `qrcode` module matrix as one SVG path: dark ink on a light, rounded paper plate in both
 * themes (scanners need the contrast). With a `center` mark (Solflare S21: the chain's mark in the middle) the code
 * uses error correction H and keeps a paper disc under the mark. It arrives once (M04: ~650 ms), settling from a
 * little small, the mark after it; the payload is exactly `value` from the first frame — never an intermediate code.
 * Reduce Motion: it is simply there.
 */
export function QrCode({
  value,
  label,
  size = SIZE.qr,
  center,
}: {
  value: string;
  label: string;
  size?: number;
  center?: ReactNode;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const { path, extent } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: center ? "H" : "M" });
    let d = "";
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (modules.get(row, col)) d += `M${col + QUIET_MODULES} ${row + QUIET_MODULES}h1v1h-1z`;
      }
    }
    return { path: d, extent: modules.size + QUIET_MODULES + QUIET_MODULES };
  }, [value, center]);
  const shown = useSharedValue(reduce ? 1 : 0);
  const mark = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    shown.value = withTiming(1, { duration: TIMING.qrReveal, easing: EASE });
    mark.value = withDelay(
      TIMING.qrReveal * CENTER_DELAY_SHARE,
      withTiming(1, { duration: TIMING.qrReveal * (1 - CENTER_DELAY_SHARE), easing: EASE }),
    );
  }, [reduce, shown, mark]);
  const codeStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: REVEAL_FROM_SCALE + (1 - REVEAL_FROM_SCALE) * shown.value }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: REVEAL_FROM_SCALE + (1 - REVEAL_FROM_SCALE) * mark.value }],
  }));
  const hole = size * CENTER_SHARE;
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.plate, { backgroundColor: color.paper, padding: SPACE.sm }, codeStyle]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${extent} ${extent}`}>
        <Rect width={extent} height={extent} fill={color.paper} />
        <Path d={path} fill={color.paperInk} />
      </Svg>
      {center ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.center, { width: hole, height: hole, backgroundColor: color.paper }, markStyle]}
        >
          {center}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute",
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

export { CENTER_SHARE as QR_CENTER_SHARE };
