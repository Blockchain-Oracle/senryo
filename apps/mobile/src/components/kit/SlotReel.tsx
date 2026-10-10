/**
 * React Native port of 21st:adrielzimbril/handle-reel (#33159; the web's `slot-reel.tsx`): a slot-machine reel that
 * tumbles through a list and decelerates onto its target. As on the web: started by `spinId`, tumbling until the draw
 * is known, landing on `target` with the source's curve, the landed row lit, a tick haptic on landing, Reduce Motion
 * lands at once.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { fire } from "~/feedback/fire";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const ROWS = 3;
const ROW_H = 36;
const CYCLES = 3;
const SPIN_MS = 2_400;
const HALF = 2;
const EASE_X1 = 0.65;
const EASE_X2 = 0.35;
const LAND = Easing.bezier(EASE_X1, 0, EASE_X2, 1);

function shuffled<T>(xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function SlotReel(p: {
  items: readonly string[];
  target: string | null;
  spinId: number;
  label: string;
  onLand?: () => void;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const [landed, setLanded] = useState(false);
  const centre = Math.floor(ROWS / HALF);
  const track = useMemo(() => {
    const pool = p.items.length > 0 ? p.items : ["—"];
    return [
      ...shuffled(pool).slice(0, centre),
      p.target ?? pool[0] ?? "—",
      ...Array.from({ length: CYCLES }, () => shuffled(pool)).flat(),
    ];
  }, [p.spinId, p.target, p.items, centre]);
  const at = (i: number) => (ROW_H * ROWS) / HALF - (i * ROW_H + ROW_H / HALF);

  useEffect(() => {
    if (p.spinId === 0) return;
    setLanded(false);
    const land = () => {
      setLanded(true);
      fire("tick");
      p.onLand?.();
    };
    if (p.target === null) {
      y.value = at(track.length - 1);
      y.value = withRepeat(withTiming(at(centre + 1), { duration: SPIN_MS, easing: Easing.linear }), -1, false);
      return () => cancelAnimation(y);
    }
    if (reduce) {
      y.value = at(centre);
      land();
      return;
    }
    y.value = withTiming(at(centre), { duration: SPIN_MS, easing: LAND }, (done) => {
      if (done) scheduleOnRN(land);
    });
    return () => cancelAnimation(y);
  }, [p.spinId, p.target, reduce]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={styles.reel}>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{p.label}</Text>
      <View
        accessible
        accessibilityLabel={landed && p.target ? `${p.label}: ${p.target}` : `${p.label}: spinning`}
        style={[styles.window, { backgroundColor: color.raised2 }]}
      >
        <Animated.View style={style}>
          {track.map((item, i) => (
            <Text
              key={i}
              style={[
                TYPE.sectionTitle,
                styles.row,
                { color: landed && i === centre ? color.primary : color.inkMuted },
              ]}
            >
              {item}
            </Text>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reel: { flex: 1, alignItems: "center", gap: SPACE.xxs },
  window: { height: ROW_H * ROWS, alignSelf: "stretch", borderRadius: RADIUS.md, overflow: "hidden" },
  row: { height: ROW_H, lineHeight: ROW_H, textAlign: "center" },
});
