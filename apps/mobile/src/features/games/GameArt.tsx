/**
 * Each game's card art on the phone hub (R7.7, research 10 §3: "show the sled, reel machine, candle canyon and card
 * table — not four interchangeable icons"): a 16:9 window onto the game itself. Line Rider and Candle Hop play
 * themselves (the attract loop, the real engine on a real tape); Lucky is its machine with the reels tumbling and the
 * lever swinging; Warm-up is a fan of live cards with the coin flipping over them. Still under reduced motion.
 */
import type { ArcadeGame } from "@senryo/core";
import { marketId, type PixelMarkName } from "@senryo/identity";
import { PixelMark } from "@senryo/identity/native";
import { Canvas, Picture } from "@shopify/react-native-skia";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { RADIUS, SPACE, useTheme } from "~/theme";
import { pixelColors } from "~/theme/pixel-colors";
import { inkOf } from "./arcade/ArcadeScreen";
import { useAttract } from "./arcade/useAttract";

const ASPECT_W = 16;
const ASPECT_H = 9;
const ASPECT = ASPECT_H / ASPECT_W;
const FACE = 30;
const ROW = 40;
const STRIP: readonly PixelMarkName[] = ["coin", "bull", "bear", "plate", "coin"];
const SPIN_A_MS = 1400;
const SPIN_B_MS = 1100;
const SPIN_C_MS = 1700;
const SPIN_MS = [SPIN_A_MS, SPIN_B_MS, SPIN_C_MS] as const;
const LEVER_DEG = 40;
const LEVER_MS = 260;
const LEVER_REST_MS = 2600;
const LEVER_W = 6;
const LEVER_H = 54;
const KNOB = 16;
const FAN = ["BTC", "ETH", "SOL"] as const;
const FAN_TILT = 12;
const FAN_DEG = [-FAN_TILT, 0, FAN_TILT] as const;
const FAN_MARK = 36;
const CARD_W = 74;
const CARD_H = 100;
const BOB = 6;
const BOB_MS = 1600;
const COIN = 28;
const FLIP_MS = 600;
const RIM = 2;
const WINDOW_GAP = 8;

function useBox() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBox({ w, h: w * ASPECT });
  };
  return { box, onLayout };
}

function ArcadeArt({ game }: { game: ArcadeGame }) {
  const { color } = useTheme();
  const calm = useReducedMotion();
  const { box, onLayout } = useBox();
  // At rest until focused: a dock tab warmed ahead of its visit (R5.24) hears no focus event, and must not play.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const picture = useAttract(game, inkOf(color), calm, box, focused && !calm);
  return (
    <View onLayout={onLayout} style={[styles.window, { height: box.h, backgroundColor: color.arena }]}>
      <Canvas style={{ width: box.w, height: box.h }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

function Reel({ ms }: { ms: number }) {
  const { color } = useTheme();
  const pixels = pixelColors(color);
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(withTiming(-ROW * (STRIP.length - 1), { duration: ms, easing: Easing.linear }), -1);
  }, [y, ms, reduce]);
  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={[styles.reel, { backgroundColor: color.arenaRaised }]}>
      <Animated.View style={strip}>
        {STRIP.map((n, i) => (
          <View key={i} style={styles.face}>
            <PixelMark name={n} size={FACE} colors={pixels} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

function LuckyArt() {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const { box, onLayout } = useBox();
  const swing = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    swing.value = withRepeat(
      withDelay(
        LEVER_REST_MS,
        withSequence(withTiming(LEVER_DEG, { duration: LEVER_MS }), withTiming(0, { duration: LEVER_MS })),
      ),
      -1,
    );
  }, [swing, reduce]);
  const lever = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }] }));
  return (
    <View
      onLayout={onLayout}
      style={[styles.window, styles.center, { height: box.h, backgroundColor: color.arena, borderColor: color.gold }]}
    >
      <View style={styles.reels}>
        {SPIN_MS.map((ms) => (
          <Reel key={ms} ms={ms} />
        ))}
      </View>
      <View style={[styles.payline, { backgroundColor: color.gold }]} />
      <Animated.View style={[styles.lever, lever]}>
        <View style={[styles.knob, { backgroundColor: color.downFill }]} />
        <View style={[styles.stick, { backgroundColor: color.gold }]} />
      </Animated.View>
    </View>
  );
}

function WarmUpArt() {
  const { color } = useTheme();
  const pixels = pixelColors(color);
  const reduce = useReducedMotion();
  const { box, onLayout } = useBox();
  const bob = useSharedValue(0);
  const flip = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    bob.value = withRepeat(withTiming(BOB, { duration: BOB_MS, easing: Easing.inOut(Easing.quad) }), -1, true);
    flip.value = withRepeat(withTiming(-1, { duration: FLIP_MS, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [bob, flip, reduce]);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value }] }));
  const coin = useAnimatedStyle(() => ({ transform: [{ scaleX: flip.value }] }));
  return (
    <View
      onLayout={onLayout}
      style={[styles.window, styles.center, { height: box.h, backgroundColor: color.arena, borderColor: color.arena }]}
    >
      <Animated.View style={[styles.fan, lift]}>
        {FAN.map((s, i) => (
          <View
            key={s}
            style={[
              styles.card,
              i > 0 && styles.overlap,
              { backgroundColor: color.arenaRaised, transform: [{ rotate: `${FAN_DEG[i]}deg` }] },
            ]}
          >
            <EntityMark id={marketId(s)} size={FAN_MARK} decorative />
          </View>
        ))}
      </Animated.View>
      <Animated.View style={[styles.coin, coin]}>
        <PixelMark name="coin" size={COIN} colors={pixels} />
      </Animated.View>
    </View>
  );
}

export function GameArt({ game }: { game: string }) {
  if (game === "line-rider" || game === "candle-hop") return <ArcadeArt game={game} />;
  if (game === "lucky") return <LuckyArt />;
  if (game === "warm-up") return <WarmUpArt />;
  return null;
}

const styles = StyleSheet.create({
  window: { borderRadius: RADIUS.md, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center", borderWidth: RIM },
  reels: { flexDirection: "row", gap: WINDOW_GAP },
  reel: { width: ROW + SPACE.md, height: ROW * 2, borderRadius: RADIUS.xs, overflow: "hidden", alignItems: "center" },
  face: { height: ROW, alignItems: "center", justifyContent: "center" },
  payline: { position: "absolute", left: SPACE.xl, right: SPACE.xxxl, height: RIM, opacity: 0.6 },
  lever: { position: "absolute", right: SPACE.xl, alignItems: "center", transformOrigin: "bottom" },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
  stick: { width: LEVER_W, height: LEVER_H, borderRadius: LEVER_W / 2 },
  fan: { flexDirection: "row" },
  overlap: { marginLeft: -SPACE.lg },
  card: { width: CARD_W, height: CARD_H, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  coin: { position: "absolute", top: SPACE.md, right: SPACE.xl },
});
