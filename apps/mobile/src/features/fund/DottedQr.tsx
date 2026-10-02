/**
 * The dotted receive QR (Solflare S21 / M04; ported from 21st.dev tom_ui/qr-code #12248 to react-native-svg): round
 * data dots, the three finder patterns drawn as a ring around a disc, dark ink on the light paper plate in both themes
 * (scanners need the contrast), error correction H so the chain badge in the middle never breaks a read. It resolves
 * once like particles settling — the finders first, then three scattered buckets of dots fading and growing in on a
 * short stagger; the payload is exactly `value` from the first frame. Reduce Motion: it is simply there.
 */
import { create } from "qrcode";
import { type ReactNode, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { EASE, RADIUS, SPACE, TIMING, useTheme } from "~/theme";

/** The second and third dot buckets start this many staggers in. */
const SECOND_BUCKET = 2;
const THIRD_BUCKET = 3;
/** Quiet zone in modules (the plate's padding adds to it). */
const QUIET = 3;
const FINDER = 7;
/** Finder ring: outer radius 3.5 modules, stroke 1; inner disc radius 1.5. */
const FINDER_CENTER = 3.5;
const RING_RADIUS = 3;
const RING_STROKE = 1;
const EYE_RADIUS = 1.5;
/** Data dots fill this share of a module. */
const DOT_RADIUS = 0.4;
const HALF = 0.5;
/** The badge hole covers this share of the code (H recovers ~30 %). */
const HOLE_SHARE = 0.22;
const BUCKETS = 3;
/** Each bucket starts this share of the reveal after the previous one. */
const BUCKET_STAGGER = 0.18;
const FROM_SCALE = 0.9;
const HASH_A = 31;
const HASH_B = 17;

function dot(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

function inFinder(row: number, col: number, n: number): boolean {
  return (row < FINDER && col < FINDER) || (row < FINDER && col >= n - FINDER) || (row >= n - FINDER && col < FINDER);
}

function useReveal(progress: SharedValue<number>, start: number) {
  return useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (progress.value - start) / (1 - start)));
    return { opacity: local, transform: [{ scale: FROM_SCALE + (1 - FROM_SCALE) * local }] };
  });
}

export function DottedQr({
  value,
  size,
  label,
  center,
}: {
  value: string;
  size: number;
  label: string;
  center?: ReactNode;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const { buckets, extent, finders } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: "H" });
    const n = modules.size;
    const hole = (n * HOLE_SHARE) / 2;
    const mid = n / 2;
    const paths = Array.from({ length: BUCKETS }, () => "");
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (!modules.get(row, col) || inFinder(row, col, n)) continue;
        if (center && Math.abs(row + HALF - mid) < hole && Math.abs(col + HALF - mid) < hole) continue;
        const bucket = (row * HASH_A + col * HASH_B) % BUCKETS;
        paths[bucket] += dot(col + QUIET + HALF, row + QUIET + HALF, DOT_RADIUS);
      }
    }
    const corners = [
      [0, 0],
      [0, n - FINDER],
      [n - FINDER, 0],
    ] as const;
    return {
      buckets: paths,
      extent: n + QUIET * 2,
      finders: corners.map(([r, c]) => ({ cx: c + QUIET + FINDER_CENTER, cy: r + QUIET + FINDER_CENTER })),
    };
  }, [value, center]);

  const progress = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: TIMING.qrReveal, easing: EASE });
  }, [reduce, progress, value]);
  const finderStyle = useReveal(progress, 0);
  const b0 = useReveal(progress, BUCKET_STAGGER);
  const b1 = useReveal(progress, BUCKET_STAGGER * SECOND_BUCKET);
  const b2 = useReveal(progress, BUCKET_STAGGER * THIRD_BUCKET);
  const centerStyle = useReveal(progress, BUCKET_STAGGER * THIRD_BUCKET);
  const bucketStyles = [b0, b1, b2];
  const box = { width: size, height: size };
  const view = `0 0 ${extent} ${extent}`;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.plate, { backgroundColor: color.paper, padding: SPACE.sm }]}
    >
      <View style={box}>
        <Animated.View style={[StyleSheet.absoluteFill, finderStyle]}>
          <Svg width={size} height={size} viewBox={view}>
            {finders.map((f) => (
              <Circle
                key={`${f.cx}:${f.cy}`}
                cx={f.cx}
                cy={f.cy}
                r={RING_RADIUS}
                stroke={color.paperInk}
                strokeWidth={RING_STROKE}
                fill="none"
              />
            ))}
            {finders.map((f) => (
              <Circle key={`eye:${f.cx}:${f.cy}`} cx={f.cx} cy={f.cy} r={EYE_RADIUS} fill={color.paperInk} />
            ))}
          </Svg>
        </Animated.View>
        {buckets.map((d, i) => (
          <Animated.View key={String(i)} style={[StyleSheet.absoluteFill, bucketStyles[i]]}>
            <Svg width={size} height={size} viewBox={view}>
              <Path d={d} fill={color.paperInk} />
            </Svg>
          </Animated.View>
        ))}
        {center ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centerWrap]}>
            <Animated.View
              style={[
                styles.center,
                { width: size * HOLE_SHARE, height: size * HOLE_SHARE, backgroundColor: color.paper },
                centerStyle,
              ]}
            >
              {center}
            </Animated.View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  centerWrap: { alignItems: "center", justifyContent: "center" },
  center: { borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
