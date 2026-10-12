/**
 * React Native port of 21st:adrielzimbril/handle-reel (#33159; the web's `slot-reel.tsx`): a slot-machine reel that
 * tumbles through a list and decelerates onto its target. As on the web: started by `spinId`, tumbling until the draw
 * is known, landing on `target` with the source's curve, the landed row lit, a tick haptic on landing, Reduce Motion
 * lands at once. R7.4 (Lucky's machine, `machine`): each reel tumbles on `stopAfterMs` past the draw (the stagger),
 * then thunks into place on a settle that overshoots and springs back; `onTick` fires as rows pass the payline; the
 * window is the arena's (D-316) and the landed row glows gold; the machine's owner plays the land haptic.
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
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
/** The machine's stop: a 300 ms settle that overshoots ≈ 4 pt and springs back. */
const SETTLE_MS = 300;
const OVERSHOOT_X1 = 0.34;
const OVERSHOOT_Y1 = 1.56;
const OVERSHOOT_X2 = 0.64;
const OVERSHOOT = Easing.bezier(OVERSHOOT_X1, OVERSHOOT_Y1, OVERSHOOT_X2, 1);
const TICK_GAP_MS = 60;

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
  /** A row's leading mark (a market's, the bull or bear, the reach plate; R2.8), at most a row high. */
  face?: (item: string) => ReactNode;
  stopAfterMs?: number;
  onTick?: () => void;
  machine?: boolean;
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
  const lastTick = useSharedValue(0);
  const onTick = p.onTick;
  useAnimatedReaction(
    () => Math.round(y.value / ROW_H),
    (row, prev) => {
      if (!onTick || prev === null || row === prev) return;
      const now = Date.now();
      if (now - lastTick.value < TICK_GAP_MS) return;
      lastTick.value = now;
      scheduleOnRN(onTick);
    },
  );

  useEffect(() => {
    if (p.spinId === 0) return;
    setLanded(false);
    const land = () => {
      setLanded(true);
      if (!p.machine) fire("tick");
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
    if (p.stopAfterMs !== undefined) {
      y.value = at(track.length - 1);
      y.value = withRepeat(withTiming(at(centre + 1), { duration: SPIN_MS, easing: Easing.linear }), -1, false);
      const timer = setTimeout(() => {
        cancelAnimation(y);
        y.value = at(centre + 1);
        y.value = withTiming(at(centre), { duration: SETTLE_MS, easing: OVERSHOOT }, (done) => {
          if (done) scheduleOnRN(land);
        });
      }, p.stopAfterMs);
      return () => {
        clearTimeout(timer);
        cancelAnimation(y);
      };
    }
    y.value = withTiming(at(centre), { duration: SPIN_MS, easing: LAND }, (done) => {
      if (done) scheduleOnRN(land);
    });
    return () => cancelAnimation(y);
  }, [p.spinId, p.target, reduce]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={styles.reel}>
      {p.machine ? null : <Text style={[TYPE.caption, { color: color.inkMuted }]}>{p.label}</Text>}
      <View
        accessible
        accessibilityLabel={landed && p.target ? `${p.label}: ${p.target}` : `${p.label}: spinning`}
        style={[styles.window, { backgroundColor: p.machine ? color.arenaRaised : color.raised2 }]}
      >
        <Animated.View style={style}>
          {track.map((item, i) => (
            <View key={i} style={styles.face}>
              {p.face?.(item)}
              <Text
                style={[
                  TYPE.sectionTitle,
                  styles.row,
                  {
                    color:
                      landed && i === centre
                        ? p.machine
                          ? color.gold
                          : color.primary
                        : p.machine
                          ? color.arenaInk
                          : color.inkMuted,
                  },
                ]}
              >
                {item}
              </Text>
            </View>
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
  face: { height: ROW_H, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs },
});
