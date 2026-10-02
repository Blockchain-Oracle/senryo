/**
 * The heart of a like (ported from 21st.dev ddoemonn/like-burst, id 23534 — motion/react on the web): the outline
 * cross-fades to the filled heart, which springs up from 0.55; on a new like eight small sparks fly out on fixed,
 * hashed angles and fade over 440 ms. Reanimated on the UI thread; Reduced Motion keeps the fill and drops the sparks.
 * The count and the write live in `Engagement`; this is only the glyph.
 */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Heart } from "~/components/kit/symbols";
import { SIZE, useTheme } from "~/theme";

/** F15's heart is about 18 pt. */
export const HEART_SIZE = 18;
const SPARK_COUNT = 8;
const SPARK_MS = 440;
/** The source's `[0.23, 1, 0.32, 1]` ease-out: control points (x1, y1) and (x2, y2). */
const SPARK_X1 = 0.23;
const SPARK_X2 = 0.32;
const SPARK_EASE = Easing.bezier(SPARK_X1, 1, SPARK_X2, 1);
/** The source's cell spring (stiffness 520, damping 34, mass 0.45). */
const FILL_SPRING = { stiffness: 520, damping: 34, mass: 0.45 } as const;
const FILL_FROM = 0.55;
const SPARK_START_SCALE = 0.6;
const SPARK_START_OPACITY = 0.85;
/** Knuth's multiplicative hash spreads the eight angles and distances without randomness (same every render). */
const HASH_MULTIPLIER = 2_654_435_761;
const HASH_MOD = 997;
const ANGLE_JITTER = 0.4;
const DISTANCE_BASE = 13;
const DISTANCE_SPREAD = 9;
const SPARK_LARGE = 4;
const SPARK_SMALL = 3;
const SPARK_DELAY_MS = 50;
const SPARK_RADIUS = 1.5;
const HALF = 0.5;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const h = (((i + 1) * HASH_MULTIPLIER) % HASH_MOD) / HASH_MOD;
  const angle = (i / SPARK_COUNT) * FULL_TURN - QUARTER_TURN + (h - HALF) * ANGLE_JITTER;
  const distance = DISTANCE_BASE + h * DISTANCE_SPREAD;
  return {
    key: `spark-${i}`,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    size: h > HALF ? SPARK_LARGE : SPARK_SMALL,
    delay: Math.round(h * SPARK_DELAY_MS),
  };
});

/** `burst` counts new likes: each change replays the sparks (0 = none yet). */
export function LikeGlyph({ liked, burst, tint }: { liked: boolean; burst: number; tint: string }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const fill = useSharedValue(liked ? 1 : FILL_FROM);
  useEffect(() => {
    fill.value = reduce ? (liked ? 1 : FILL_FROM) : withSpring(liked ? 1 : FILL_FROM, FILL_SPRING);
  }, [liked, reduce, fill]);
  const filled = useAnimatedStyle(() => ({ transform: [{ scale: fill.value }] }));
  return (
    <View style={styles.box}>
      {liked ? (
        <Animated.View style={filled}>
          <Heart size={HEART_SIZE} strokeWidth={SIZE.iconStroke} color={color.link} fill={color.link} />
        </Animated.View>
      ) : (
        <Heart size={HEART_SIZE} strokeWidth={SIZE.iconStroke} color={tint} fill={color.transparent} />
      )}
      {!reduce && burst > 0 ? (
        <View key={burst} pointerEvents="none" style={styles.origin}>
          {SPARKS.map(({ key, ...spark }) => (
            <Spark key={key} {...spark} color={color.link} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Spark({ x, y, size, delay, color }: { x: number; y: number; size: number; delay: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: SPARK_MS, easing: SPARK_EASE }));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: SPARK_START_OPACITY * (1 - t.value),
    transform: [
      { translateX: x * t.value },
      { translateY: y * t.value },
      { scale: SPARK_START_SCALE + (1 - SPARK_START_SCALE) * t.value },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.spark,
        { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  box: { width: HEART_SIZE, height: HEART_SIZE, alignItems: "center", justifyContent: "center" },
  origin: { position: "absolute", left: HEART_SIZE / 2, top: HEART_SIZE / 2, width: 0, height: 0 },
  spark: { position: "absolute", borderRadius: SPARK_RADIUS },
});
