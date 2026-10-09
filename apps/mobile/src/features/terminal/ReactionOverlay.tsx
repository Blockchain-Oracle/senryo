/**
 * Tradash's reactions overlay (`aX`, via Owarine's `ui/ReactionOverlay.tsx`): an inset edge glow for 0.9 s on a surge
 * (up colour, deeper for a mega move) or a slump (down colour), and emoji callouts that ride the price head — at most
 * two, each living by its tone (good/bad 1.5 s, great 1.8 s, epic 2.2 s, warn 2.6 s), springing in (bouncier for epic)
 * and lifting out. The head comes from the chart's frame on the UI thread, so following it never renders React.
 */

import { CALLOUT_LIFETIME_MS, type CalloutTone } from "@senryo/calls";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  FadeOutUp,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { SPACE, TYPE, useTheme } from "~/theme";
import type { Head } from "./chart/draw";

const MAX_SHOWN = 2;
const FLASH_MS = 900;
/** Flash keyframes (Owarine: opacity 0 → 1 → 0.6 → 0 at 0, 15 %, 50 %, 100 %). */
const FLASH_PEAK = 0.15;
const FLASH_HOLD = 0.35;
const FLASH_FADE = 0.5;
const FLASH_MID_OPACITY = 0.6;
const GLOW_RADIUS = 50;
const MEGA_GLOW_RADIUS = 70;
const SPRING_STIFFNESS = 520;
const EPIC_DAMPING = 14;
const CALM_DAMPING = 22;
const EXIT_MS = 220;
/** Callouts sit above and left of the head. */
const HEAD_LEFT = 12;
const HEAD_ABOVE = 20;

export interface ReactionOverlayHandle {
  callout(tone: CalloutTone, emoji: string, text: string): void;
  flash(favorable: boolean, mega: boolean): void;
}

interface Shown {
  id: number;
  tone: CalloutTone;
  emoji: string;
  text: string;
}

export const ReactionOverlay = forwardRef<ReactionOverlayHandle, { head: SharedValue<Head | null> }>(
  function ReactionOverlay({ head }, ref) {
    const { color } = useTheme();
    const reduce = useReducedMotion();
    const [shown, setShown] = useState<Shown[]>([]);
    const [glow, setGlow] = useState<{ favorable: boolean; mega: boolean }>({ favorable: true, mega: false });
    const seq = useRef(0);
    const flashOpacity = useSharedValue(0);

    useImperativeHandle(ref, () => ({
      callout(tone, emoji, text) {
        seq.current += 1;
        const id = seq.current;
        setShown((s) => [...s, { id, tone, emoji, text }].slice(-MAX_SHOWN));
        setTimeout(() => setShown((s) => s.filter((x) => x.id !== id)), CALLOUT_LIFETIME_MS[tone]);
      },
      flash(favorable, mega) {
        setGlow({ favorable, mega });
        flashOpacity.value = withSequence(
          withTiming(1, { duration: FLASH_MS * FLASH_PEAK }),
          withTiming(FLASH_MID_OPACITY, { duration: FLASH_MS * FLASH_HOLD }),
          withTiming(0, { duration: FLASH_MS * FLASH_FADE }),
        );
      },
    }));

    const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
    const anchor = useAnimatedStyle(() => {
      const at = head.value;
      return at
        ? { opacity: 1, transform: [{ translateX: at.x - HEAD_LEFT }, { translateY: at.y - HEAD_ABOVE }] }
        : { opacity: 0 };
    });

    const tint: Record<CalloutTone, string> = {
      good: color.up,
      great: color.up,
      epic: color.accent,
      bad: color.down,
      warn: color.warn,
    };
    const shadow = glow.favorable ? (glow.mega ? color.megaGlow : color.surgeGlow) : color.slumpGlow;

    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { boxShadow: `inset 0 0 ${glow.mega ? MEGA_GLOW_RADIUS : GLOW_RADIUS}px ${shadow}` },
            flashStyle,
          ]}
        />
        <Animated.View style={[styles.anchor, anchor]}>
          <View style={styles.stack}>
            {shown.map((c) => (
              <Animated.View
                key={c.id}
                entering={
                  reduce
                    ? FadeIn
                    : ZoomIn.springify()
                        .stiffness(SPRING_STIFFNESS)
                        .damping(c.tone === "epic" ? EPIC_DAMPING : CALM_DAMPING)
                }
                exiting={reduce ? FadeOut : FadeOutUp.duration(EXIT_MS)}
              >
                <Text
                  numberOfLines={1}
                  style={[TYPE.rowTitle, styles.callout, { color: tint[c.tone], textShadowColor: color.ground }]}
                >
                  {c.emoji} {c.text}
                </Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  anchor: { position: "absolute", left: 0, top: 0 },
  stack: { position: "absolute", right: 0, bottom: 0, alignItems: "flex-end", gap: SPACE.xs },
  callout: { fontStyle: "italic", fontWeight: "800", textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
});
